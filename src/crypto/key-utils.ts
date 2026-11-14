import {
  createPrivateKey,
  createPublicKey,
  createHash,
  diffieHellman,
  generateKeyPairSync,
  randomBytes,
  verify as nodeVerify,
} from 'node:crypto'
import { CryptoError } from '../core/errors.js'

export interface Curve25519KeyPair {
  readonly public: Uint8Array
  readonly private: Uint8Array
}

const X25519_PKCS8 = Buffer.from('302e020100300506032b656e04220420', 'hex')
const X25519_SPKI = Buffer.from('302a300506032b656e032100', 'hex')
const ED25519_SPKI = Buffer.from('302a300506032b6570032100', 'hex')

// ---- format kunci Signal (prefix 0x05) ------------------------------------

export function toSignalPubKey(pub: Uint8Array): Buffer {
  if (pub.length === 33) {
    if (pub[0] !== 5) throw new CryptoError('Invalid Signal public key prefix')
    return Buffer.from(pub)
  }
  if (pub.length !== 32) throw new CryptoError(`Invalid public key length: ${pub.length}`)
  return Buffer.concat([Buffer.from([5]), pub])
}

export function fromSignalPubKey(pub: Uint8Array): Buffer {
  if (pub.length === 33) {
    if (pub[0] !== 5) throw new CryptoError('Invalid Signal public key prefix')
    return Buffer.from(pub.subarray(1))
  }
  if (pub.length !== 32) throw new CryptoError(`Invalid public key length: ${pub.length}`)
  return Buffer.from(pub)
}

// ---- X25519 ----------------------------------------------------------------

function clamp(priv: Uint8Array): Buffer {
  const out = Buffer.from(priv)
  out[0] = out[0]! & 248
  out[31] = (out[31]! & 127) | 64
  return out
}

/** Pasangan kunci X25519 (private key di-clamp, public 32 byte). */
export function generateKeyPair(): Curve25519KeyPair {
  const { privateKey } = generateKeyPairSync('x25519')
  const jwk = privateKey.export({ format: 'jwk' })
  if (!jwk.x || !jwk.d) throw new CryptoError('Failed to export X25519 key pair')
  return { public: Buffer.from(jwk.x, 'base64url'), private: clamp(Buffer.from(jwk.d, 'base64url')) }
}

/** Turunkan public key dari private key X25519. */
export function publicFromPrivate(privateKey: Uint8Array): Buffer {
  const key = createPrivateKey({
    key: Buffer.concat([X25519_PKCS8, clamp(privateKey)]),
    format: 'der',
    type: 'pkcs8',
  })
  const jwk = createPublicKey(key).export({ format: 'jwk' })
  return Buffer.from(jwk.x!, 'base64url')
}

/** ECDH X25519. `publicKey` boleh 32 byte atau 33 byte berprefix 0x05. */
export function sharedKey(privateKey: Uint8Array, publicKey: Uint8Array): Buffer {
  const priv = createPrivateKey({
    key: Buffer.concat([X25519_PKCS8, clamp(privateKey)]),
    format: 'der',
    type: 'pkcs8',
  })
  const pub = createPublicKey({
    key: Buffer.concat([X25519_SPKI, fromSignalPubKey(publicKey)]),
    format: 'der',
    type: 'spki',
  })
  return diffieHellman({ privateKey: priv, publicKey: pub })
}

// ---- aritmetika Ed25519 (BigInt) -------------------------------------------

const P = 2n ** 255n - 19n
const L = 2n ** 252n + 27742317777372353535851937790883648493n

const mod = (a: bigint, m: bigint = P): bigint => ((a % m) + m) % m

function pow(base: bigint, exp: bigint, m: bigint = P): bigint {
  let result = 1n
  let b = mod(base, m)
  let e = exp
  while (e > 0n) {
    if (e & 1n) result = (result * b) % m
    b = (b * b) % m
    e >>= 1n
  }
  return result
}

const inv = (a: bigint): bigint => pow(a, P - 2n)
const D = mod(-121665n * inv(121666n))
const D2 = mod(2n * D)
const SQRT_M1 = pow(2n, (P - 1n) / 4n)

type Point = readonly [bigint, bigint, bigint, bigint] // X, Y, Z, T (extended)

function recoverX(y: bigint, sign: number): bigint | undefined {
  const x2 = mod((y * y - 1n) * inv(D * y * y + 1n))
  if (x2 === 0n) return sign ? undefined : 0n
  let x = pow(x2, (P + 3n) / 8n)
  if (mod(x * x - x2) !== 0n) x = mod(x * SQRT_M1)
  if (mod(x * x - x2) !== 0n) return undefined
  if (Number(x & 1n) !== sign) x = P - x
  return x
}

const BY = mod(4n * inv(5n))
const BX = recoverX(BY, 0)!
const BASE: Point = [BX, BY, 1n, mod(BX * BY)]
const IDENTITY: Point = [0n, 1n, 1n, 0n]

function add(p: Point, q: Point): Point {
  const [x1, y1, z1, t1] = p
  const [x2, y2, z2, t2] = q
  const a = mod((y1 - x1) * (y2 - x2))
  const b = mod((y1 + x1) * (y2 + x2))
  const c = mod(t1 * D2 * t2)
  const d = mod(z1 * 2n * z2)
  const e = b - a
  const f = d - c
  const g = d + c
  const h = b + a
  return [mod(e * f), mod(g * h), mod(f * g), mod(e * h)]
}

function mul(point: Point, scalar: bigint): Point {
  let result = IDENTITY
  let addend = point
  let k = scalar
  while (k > 0n) {
    if (k & 1n) result = add(result, addend)
    addend = add(addend, addend)
    k >>= 1n
  }
  return result
}

const bytesToBig = (bytes: Uint8Array): bigint => {
  let n = 0n
  for (let i = bytes.length - 1; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]!)
  return n
}

const bigToBytes = (n: bigint, length = 32): Buffer => {
  const out = Buffer.alloc(length)
  let v = n
  for (let i = 0; i < length; i++) {
    out[i] = Number(v & 0xffn)
    v >>= 8n
  }
  return out
}

function encodePoint(p: Point): Buffer {
  const zi = inv(p[2])
  const x = mod(p[0] * zi)
  const y = mod(p[1] * zi)
  const out = bigToBytes(y)
  out[31] = out[31]! | (Number(x & 1n) << 7)
  return out
}

const sha512 = (...parts: Uint8Array[]): Buffer => {
  const h = createHash('sha512')
  for (const part of parts) h.update(part)
  return h.digest()
}

/** Ekspor untuk test internal. */
export const _internals = { BASE, L, mul, add, encodePoint, IDENTITY }

// ---- XEdDSA (tanda tangan curve25519 ala libsignal) --------------------------

/** y Edwards dari u Montgomery: y = (u - 1) / (u + 1). */
function montgomeryToEdwardsY(u: bigint): bigint {
  const denom = mod(u + 1n)
  if (denom === 0n) throw new CryptoError('Invalid public key')
  return mod((u - 1n) * inv(denom))
}

function edwardsPublicFromMontgomery(pub: Uint8Array, signBit: number): Buffer {
  const raw = Buffer.from(fromSignalPubKey(pub))
  raw[31] = raw[31]! & 0x7f
  const out = bigToBytes(montgomeryToEdwardsY(bytesToBig(raw)))
  out[31] = out[31]! | (signBit << 7)
  return out
}

/** Tanda tangan XEdDSA (64 byte) atas `message` dengan private key X25519. */
export function sign(privateKey: Uint8Array, message: Uint8Array): Buffer {
  let a = bytesToBig(clamp(privateKey)) % L
  let aPub = encodePoint(mul(BASE, a))
  if (aPub[31]! & 0x80) {
    a = mod(L - a, L) // paksa sign bit = 0
    aPub = encodePoint(mul(BASE, a))
  }
  const aBytes = bigToBytes(a)

  const prefix = Buffer.alloc(32, 0xff)
  prefix[0] = 0xfe
  const r = bytesToBig(sha512(prefix, aBytes, message, randomBytes(64))) % L
  const rEnc = encodePoint(mul(BASE, r))
  const h = bytesToBig(sha512(rEnc, aPub, message)) % L
  const s = (r + h * a) % L
  return Buffer.concat([rEnc, bigToBytes(s)])
}

/** Verifikasi tanda tangan XEdDSA. `publicKey` 32 atau 33 byte (prefix 0x05). */
export function verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
  if (signature.length !== 64) return false
  try {
    const sig = Buffer.from(signature)
    const signBit = sig[63]! >> 7
    sig[63] = sig[63]! & 0x7f
    const edPub = edwardsPublicFromMontgomery(publicKey, signBit)
    const key = createPublicKey({ key: Buffer.concat([ED25519_SPKI, edPub]), format: 'der', type: 'spki' })
    return nodeVerify(null, message, key, sig)
  } catch {
    return false
  }
}

/** Implementasi `KeyPairProvider` (dipakai modul auth). */
export const curveKeyPairProvider = {
  generateKeyPair,
  sign: (privateKey: Uint8Array, message: Uint8Array): Uint8Array => sign(privateKey, message),
}
