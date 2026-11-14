import { MediaError } from '../core/errors.js'
import { detectMime, mimeFromFileName } from './media-types.js'

export interface PreparedDocument {
  mimetype: string
  fileName: string
  title: string
}

export interface PrepareDocumentOptions {
  fileName?: string
  mimetype?: string
  /** Awal berkas, untuk deteksi MIME. */
  head?: Uint8Array
}

export function prepareDocument(options: PrepareDocumentOptions): PreparedDocument {
  const fileName = options.fileName?.trim() || 'file'
  if (/[\\/\0]/.test(fileName)) throw new MediaError('fileName must not contain path separators')

  const mimetype =
    options.mimetype ??
    mimeFromFileName(fileName) ??
    (options.head ? detectMime(options.head) : undefined) ??
    'application/octet-stream'
  return { mimetype, fileName, title: fileName }
}
