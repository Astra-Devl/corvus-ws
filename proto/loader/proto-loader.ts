import { readdir, readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { ProtocolError } from '../../src/core/errors.js'
import {
  isPackableType,
  isScalarType,
  type EnumDescriptor,
  type FieldDescriptor,
  type FileDescriptor,
  type MessageDescriptor,
  type ProtoRegistry,
  type ScalarType,
} from './proto-registry.js'

type TokenKind = 'ident' | 'number' | 'string' | 'symbol'

interface Token {
  kind: TokenKind
  value: string
  line: number
}

function tokenize(source: string, file: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  let line = 1
  const fail = (message: string): never => {
    throw new ProtocolError(`${file}:${line}: ${message}`, { data: { file, line } })
  }

  while (i < source.length) {
    const ch = source[i]!
    if (ch === '\n') {
      line++
      i++
    } else if (ch === ' ' || ch === '\t' || ch === '\r') {
      i++
    } else if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++
    } else if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      if (end === -1) fail('Unterminated block comment')
      for (const c of source.slice(i, end)) if (c === '\n') line++
      i = end + 2
    } else if (ch === '"' || ch === "'") {
      let value = ''
      i++
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\n') fail('Unterminated string literal')
        if (source[i] === '\\') {
          i++
          const esc = source[i]
          value += esc === 'n' ? '\n' : esc === 't' ? '\t' : esc === 'r' ? '\r' : (esc ?? '')
        } else {
          value += source[i]
        }
        i++
      }
      if (source[i] !== ch) fail('Unterminated string literal')
      i++
      tokens.push({ kind: 'string', value, line })
    } else if (/[A-Za-z_]/.test(ch)) {
      const start = i
      while (i < source.length && /[A-Za-z0-9_]/.test(source[i]!)) i++
      tokens.push({ kind: 'ident', value: source.slice(start, i), line })
    } else if (/[0-9]/.test(ch) || (ch === '-' && /[0-9]/.test(source[i + 1] ?? ''))) {
      const start = i
      i++
      while (i < source.length && /[0-9A-Fa-fxX.+eE-]/.test(source[i]!)) {
        // `+`/`-` hanya sah tepat setelah eksponen (mis. 1e-5).
        if ((source[i] === '+' || source[i] === '-') && !/[eE]/.test(source[i - 1]!)) break
        i++
      }
      tokens.push({ kind: 'number', value: source.slice(start, i), line })
    } else if ('{}[]()<>=;,.:'.includes(ch)) {
      tokens.push({ kind: 'symbol', value: ch, line })
      i++
    } else {
      fail(`Unexpected character "${ch}"`)
    }
  }
  return tokens
}

class Parser {
  readonly #tokens: Token[]
  readonly #file: string
  #pos = 0
  #syntax: 'proto2' | 'proto3' = 'proto2'
  #package = ''
  readonly #result: FileDescriptor

  constructor(source: string, file: string) {
    this.#file = file
    this.#tokens = tokenize(source, file)
    this.#result = { name: file, package: '', syntax: 'proto2', imports: [], messages: [], enums: [] }
  }

  parse(): FileDescriptor {
    while (!this.#eof()) {
      const token = this.#next()
      if (token.kind === 'symbol' && token.value === ';') continue
      if (token.kind !== 'ident') this.#fail(token, `Unexpected "${token.value}"`)

      switch (token.value) {
        case 'syntax': {
          this.#expect('=')
          const value = this.#expectKind('string').value
          if (value !== 'proto2' && value !== 'proto3') this.#fail(token, `Unsupported syntax "${value}"`)
          this.#syntax = value as 'proto2' | 'proto3'
          this.#result.syntax = this.#syntax
          this.#expect(';')
          break
        }
        case 'package':
          this.#package = this.#qualifiedName()
          this.#result.package = this.#package
          this.#expect(';')
          break
        case 'import': {
          const next = this.#peek()
          if (next?.kind === 'ident' && (next.value === 'public' || next.value === 'weak')) this.#next()
          this.#result.imports.push(this.#expectKind('string').value)
          this.#expect(';')
          break
        }
        case 'option':
          this.#skipStatement()
          break
        case 'message':
          this.#message(this.#package)
          break
        case 'enum':
          this.#enum(this.#package)
          break
        default:
          this.#fail(token, `"${token.value}" is not supported at top level`)
      }
    }
    return this.#result
  }

  // --- helpers token ---------------------------------------------------------

  #eof(): boolean {
    return this.#pos >= this.#tokens.length
  }

  #peek(offset = 0): Token | undefined {
    return this.#tokens[this.#pos + offset]
  }

  #next(): Token {
    const token = this.#tokens[this.#pos++]
    if (!token) {
      const last = this.#tokens[this.#tokens.length - 1]
      throw new ProtocolError(`${this.#file}:${last?.line ?? 1}: Unexpected end of file`, {
        data: { file: this.#file },
      })
    }
    return token
  }

  #fail(token: Token | undefined, message: string): never {
    throw new ProtocolError(`${this.#file}:${token?.line ?? 0}: ${message}`, {
      data: { file: this.#file, line: token?.line },
    })
  }

  #isSymbol(value: string): boolean {
    const token = this.#peek()
    return token?.kind === 'symbol' && token.value === value
  }

  #expect(symbol: string): Token {
    const token = this.#next()
    if (token.kind !== 'symbol' || token.value !== symbol) {
      this.#fail(token, `Expected "${symbol}" but found "${token.value}"`)
    }
    return token
  }

  #expectKind(kind: TokenKind): Token {
    const token = this.#next()
    if (token.kind !== kind) this.#fail(token, `Expected ${kind} but found "${token.value}"`)
    return token
  }

  #qualifiedName(): string {
    let name = ''
    if (this.#isSymbol('.')) {
      this.#next()
      name = '.'
    }
    name += this.#expectKind('ident').value
    while (this.#isSymbol('.')) {
      this.#next()
      name += `.${this.#expectKind('ident').value}`
    }
    return name
  }

  #integer(): number {
    const token = this.#expectKind('number')
    const value = Number(token.value)
    if (!Number.isInteger(value)) this.#fail(token, `Expected an integer but found "${token.value}"`)
    return value
  }

  /** Lewati sampai `;` penutup (menghormati `{}` / `[]` bersarang). */
  #skipStatement(): void {
    let depth = 0
    for (;;) {
      const token = this.#next()
      if (token.kind !== 'symbol') continue
      if (token.value === '{' || token.value === '[') depth++
      else if (token.value === '}' || token.value === ']') depth--
      else if (token.value === ';' && depth <= 0) return
    }
  }

  // --- grammar ---------------------------------------------------------------

  #message(scope: string): void {
    const nameToken = this.#expectKind('ident')
    const fullName = scope ? `${scope}.${nameToken.value}` : nameToken.value
    const message: MessageDescriptor = { fullName, name: nameToken.value, fields: [], oneofs: [] }
    this.#result.messages.push(message)
    this.#expect('{')

    for (;;) {
      const token = this.#next()
      if (token.kind === 'symbol') {
        if (token.value === '}') return
        if (token.value === ';') continue
        this.#fail(token, `Unexpected "${token.value}"`)
      }
      if (token.kind !== 'ident') this.#fail(token, `Unexpected "${token.value}"`)

      switch (token.value) {
        case 'message':
          this.#message(fullName)
          break
        case 'enum':
          this.#enum(fullName)
          break
        case 'oneof':
          this.#oneof(message)
          break
        case 'reserved':
        case 'extensions':
        case 'option':
          this.#skipStatement()
          break
        case 'extend':
        case 'group':
          this.#fail(token, `"${token.value}" is not supported`)
          break
        case 'map':
          if (this.#isSymbol('<')) {
            message.fields.push(this.#mapField())
            break
          }
          message.fields.push(this.#field(token, 'optional'))
          break
        case 'optional':
        case 'required':
        case 'repeated': {
          const type = this.#next()
          message.fields.push(this.#field(type, token.value))
          break
        }
        default:
          // proto3 mengizinkan field tanpa label.
          message.fields.push(this.#field(token, 'optional'))
      }
    }
  }

  /** `first` adalah token awal nama tipe (sudah dibaca). */
  #field(first: Token, label: FieldDescriptor['label'], oneof?: string): FieldDescriptor {
    let typeName = first.value
    if (first.kind === 'symbol' && first.value === '.') typeName = `.${this.#expectKind('ident').value}`
    else if (first.kind !== 'ident') this.#fail(first, `Expected a type but found "${first.value}"`)
    while (this.#isSymbol('.')) {
      this.#next()
      typeName += `.${this.#expectKind('ident').value}`
    }

    const name = this.#expectKind('ident').value
    this.#expect('=')
    const number = this.#integer()
    if (number < 1 || number > 536870911) this.#fail(first, `Field number ${number} is out of range`)
    const options = this.#fieldOptions()
    this.#expect(';')

    const scalar = isScalarType(typeName)
    const type = scalar ? (typeName as ScalarType) : 'unresolved'
    const wantsPacked = options.packed ?? this.#syntax === 'proto3'
    const field: FieldDescriptor = {
      name,
      number,
      type,
      label,
      packed: label === 'repeated' && wantsPacked && (!scalar || isPackableType(type)),
    }
    if (!scalar) field.typeName = typeName
    if (oneof) field.oneof = oneof
    return field
  }

  #mapField(): FieldDescriptor {
    this.#expect('<')
    const keyToken = this.#expectKind('ident')
    if (!isScalarType(keyToken.value) || keyToken.value === 'bytes' || keyToken.value === 'double' || keyToken.value === 'float') {
      this.#fail(keyToken, `Invalid map key type "${keyToken.value}"`)
    }
    this.#expect(',')
    const valueName = this.#qualifiedName()
    this.#expect('>')
    const name = this.#expectKind('ident').value
    this.#expect('=')
    const number = this.#integer()
    this.#fieldOptions()
    this.#expect(';')

    const scalar = isScalarType(valueName)
    return {
      name,
      number,
      type: 'message',
      label: 'repeated',
      packed: false,
      map: {
        key: keyToken.value as ScalarType,
        value: scalar ? (valueName as ScalarType) : 'unresolved',
        ...(!scalar && { valueTypeName: valueName }),
      },
    }
  }

  #fieldOptions(): { packed?: boolean } {
    const result: { packed?: boolean } = {}
    if (!this.#isSymbol('[')) return result
    this.#next()
    for (;;) {
      const key = this.#qualifiedName()
      this.#expect('=')
      let depth = 0
      const valueToken = this.#peek()
      // Nilai bisa literal atau agregat `{ ... }`; hanya `packed` yang dipakai.
      for (;;) {
        const token = this.#next()
        if (token.kind === 'symbol' && token.value === '{') depth++
        else if (token.kind === 'symbol' && token.value === '}') depth--
        if (depth === 0) break
      }
      if (key === 'packed') result.packed = valueToken?.value === 'true'
      if (this.#isSymbol(',')) {
        this.#next()
        continue
      }
      this.#expect(']')
      return result
    }
  }

  #oneof(message: MessageDescriptor): void {
    const name = this.#expectKind('ident').value
    message.oneofs.push(name)
    this.#expect('{')
    for (;;) {
      const token = this.#next()
      if (token.kind === 'symbol' && token.value === '}') return
      if (token.kind === 'ident' && token.value === 'option') {
        this.#skipStatement()
        continue
      }
      message.fields.push(this.#field(token, 'optional', name))
    }
  }

  #enum(scope: string): void {
    const nameToken = this.#expectKind('ident')
    const fullName = scope ? `${scope}.${nameToken.value}` : nameToken.value
    const en: EnumDescriptor = { fullName, name: nameToken.value, values: {} }
    this.#result.enums.push(en)
    this.#expect('{')
    for (;;) {
      const token = this.#next()
      if (token.kind === 'symbol') {
        if (token.value === '}') return
        if (token.value === ';') continue
        this.#fail(token, `Unexpected "${token.value}"`)
      }
      if (token.kind === 'ident' && (token.value === 'option' || token.value === 'reserved')) {
        this.#skipStatement()
        continue
      }
      if (token.kind !== 'ident') this.#fail(token, `Unexpected "${token.value}"`)
      this.#expect('=')
      const value = this.#integer()
      this.#fieldOptions()
      this.#expect(';')
      if (token.value in en.values) this.#fail(token, `Duplicate enum value "${token.value}"`)
      en.values[token.value] = value
    }
  }
}

/** Parse isi file `.proto` menjadi descriptor (belum di-link). */
export function parseProto(source: string, name = 'inline.proto'): FileDescriptor {
  return new Parser(source, name).parse()
}

/** Parse (dengan cache) lalu daftarkan ke registry. */
export function loadProtoSource(registry: ProtoRegistry, source: string, name = 'inline.proto'): FileDescriptor {
  const file = registry.cache.parsed(name, source, () => parseProto(source, name))
  registry.add(file)
  return file
}

export async function loadProtoFile(registry: ProtoRegistry, path: string): Promise<FileDescriptor> {
  return loadProtoSource(registry, await readFile(path, 'utf8'), basename(path))
}

/** Muat semua `*.proto` di sebuah folder, lalu link. */
export async function loadProtoDirectory(registry: ProtoRegistry, directory: string): Promise<FileDescriptor[]> {
  const names = (await readdir(directory)).filter((n) => n.endsWith('.proto')).sort()
  const files: FileDescriptor[] = []
  for (const name of names) files.push(await loadProtoFile(registry, join(directory, name)))
  registry.link()
  return files
}
