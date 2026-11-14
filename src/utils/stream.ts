import { createHash } from 'node:crypto'
import { Readable, Transform } from 'node:stream'

export class StreamTooLargeError extends RangeError {
  constructor(readonly limit: number) {
    super(`Stream exceeds ${limit} bytes`)
  }
}

/** Kumpulkan stream ke Buffer dengan batas ukuran opsional. */
export async function streamToBuffer(stream: AsyncIterable<Uint8Array>, maxBytes = Number.POSITIVE_INFINITY): Promise<Buffer> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of stream) {
    total += chunk.length
    if (total > maxBytes) {
      ;(stream as Partial<Readable>).destroy?.()
      throw new StreamTooLargeError(maxBytes)
    }
    chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.length))
  }
  return Buffer.concat(chunks)
}

export const bufferToStream = (data: Uint8Array, chunkSize = 64 * 1024): Readable =>
  Readable.from(
    (function* () {
      for (let i = 0; i < data.length; i += chunkSize) yield data.subarray(i, i + chunkSize)
    })(),
  )

/** Transform yang melewatkan data apa adanya sambil menghitung hash dan panjang. */
export function createHashingStream(algorithm = 'sha256'): Transform & { digest(): Buffer; readonly length: number } {
  const hash = createHash(algorithm)
  let length = 0
  const stream = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      hash.update(chunk)
      length += chunk.length
      cb(null, chunk)
    },
  }) as Transform & { digest(): Buffer; readonly length: number }
  Object.defineProperties(stream, { digest: { value: () => hash.digest() }, length: { get: () => length } })
  return stream
}

/** Batasi total byte yang boleh lewat; melebihi batas -> error. */
export function createLimitStream(maxBytes: number): Transform {
  let total = 0
  return new Transform({
    transform(chunk: Buffer, _enc, cb) {
      total += chunk.length
      if (total > maxBytes) cb(new StreamTooLargeError(maxBytes))
      else cb(null, chunk)
    },
  })
}
