import { AuthError } from '../core/errors.js'
import { isAuthCreds } from './auth-utils.js'
import type { AuthCreds } from './credentials.js'
import type { SignalKeyStore } from './key-store.js'

export interface AuthState {
  creds: AuthCreds
  keys: SignalKeyStore
}

/** Hasil dari penyedia penyimpanan auth (memory, multi-file, atau buatan sendiri). */
export interface AuthStateProvider {
  readonly state: AuthState
  /** Simpan `state.creds` ke penyimpanan. */
  saveCreds(): Promise<void>
  /** Hapus semua data session. */
  clear?(): Promise<void>
}

export function assertAuthState(value: unknown): asserts value is AuthState {
  const v = value as Partial<AuthState> | null | undefined
  if (!v || !isAuthCreds(v.creds) || !v.keys || typeof v.keys.get !== 'function') {
    throw new AuthError('Invalid auth state: expected { creds, keys }')
  }
}
