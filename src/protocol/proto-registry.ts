import {
  PROTO_NAMES,
  createRegistry,
  loadProtoSource,
  registry,
  type FileDescriptor,
  type ProtoRegistry,
  type ProtoTypeName,
  type ProtoTypes,
} from '../../proto/index.js'

export type { ProtoTypeName, ProtoTypes }

/** Registry skema bawaan (dipakai semua fungsi `*Proto` di modul protocol). */
export const protoRegistry: ProtoRegistry = registry

/** Buat registry baru yang terpisah dari registry bawaan. */
export const createProtoRegistry = createRegistry

/** Daftarkan skema `.proto` tambahan ke registry (default: registry bawaan). */
export function registerProtoSchema(source: string, name = 'custom.proto', target: ProtoRegistry = protoRegistry): FileDescriptor {
  const file = loadProtoSource(target, source, name)
  target.link()
  return file
}

/** Nama pendek (`Message`, `ClientPayload_UserAgent`) -> nama lengkap; nama lain dikembalikan apa adanya. */
export function resolveProtoName(name: string): string {
  return Object.hasOwn(PROTO_NAMES, name) ? (PROTO_NAMES as Record<string, string>)[name]! : name
}
