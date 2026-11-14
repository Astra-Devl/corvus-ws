import type { ResolvedSocketConfig } from '../core/socket-config.js'
import type { SocketModule } from '../core/socket.js'
import type { SocketState } from '../core/socket-state.js'
import type { TypedEventEmitter } from '../core/event-emitter.js'
import type { InMemoryStore } from '../store/in-memory-store.js'
import { VERSION } from '../version.js'

export interface DiagnosticsSource {
  id: string
  state: SocketState
  config: ResolvedSocketConfig
  modules: readonly SocketModule[]
  ev: TypedEventEmitter<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  store?: InMemoryStore | undefined
  pendingQueries?: () => number
}

export interface Diagnostics {
  version: string
  node: string
  platform: string
  id: string
  status: string
  uptimeMs: number
  lastDisconnect: { at: string; message: string | undefined } | undefined
  modules: string[]
  /** Data sensitif (kunci, auth) tidak pernah disertakan. */
  config: { url: string; origin: string; autoReconnect: boolean; keepAliveIntervalMs: number; connectTimeoutMs: number }
  store: { chats: number; contacts: number; groups: number; chatsWithMessages: number } | undefined
  pendingQueries: number | undefined
  memory: { rssMB: number; heapUsedMB: number }
}

const mb = (bytes: number): number => Math.round((bytes / 1024 / 1024) * 10) / 10

/** Cuplikan keadaan socket untuk debugging / laporan bug. */
export function collectDiagnostics(source: DiagnosticsSource): Diagnostics {
  const mem = process.memoryUsage()
  const last = source.state.lastDisconnect
  return {
    version: VERSION,
    node: process.versions.node,
    platform: `${process.platform}-${process.arch}`,
    id: source.id,
    status: source.state.status,
    uptimeMs: source.state.uptimeMs,
    lastDisconnect: last ? { at: last.date.toISOString(), message: last.error?.message } : undefined,
    modules: source.modules.map((m) => m.name),
    config: {
      url: source.config.url,
      origin: source.config.origin,
      autoReconnect: source.config.autoReconnect,
      keepAliveIntervalMs: source.config.keepAliveIntervalMs,
      connectTimeoutMs: source.config.connectTimeoutMs,
    },
    store: source.store && {
      chats: source.store.chats.size,
      contacts: source.store.contacts.size,
      groups: source.store.groups.size,
      chatsWithMessages: source.store.messages.chatIds.length,
    },
    pendingQueries: source.pendingQueries?.(),
    memory: { rssMB: mb(mem.rss), heapUsedMB: mb(mem.heapUsed) },
  }
}

export function formatDiagnostics(d: Diagnostics): string {
  return [
    `corvus-ws ${d.version} (node ${d.node}, ${d.platform})`,
    `socket ${d.id}: ${d.status}, uptime ${Math.round(d.uptimeMs / 1000)}s`,
    `modules: ${d.modules.join(', ')}`,
    d.lastDisconnect ? `last disconnect: ${d.lastDisconnect.at} ${d.lastDisconnect.message ?? ''}`.trim() : 'last disconnect: -',
    d.store ? `store: ${d.store.chats} chats, ${d.store.contacts} contacts, ${d.store.groups} groups` : 'store: disabled',
    `memory: rss ${d.memory.rssMB} MB, heap ${d.memory.heapUsedMB} MB`,
  ].join('\n')
}
