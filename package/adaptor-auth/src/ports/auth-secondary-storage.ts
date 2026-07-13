/**
 * Ephemeral key/value storage for Better Auth session and rate-limit data.
 * Primary auth tables remain in Postgres; this port accelerates hot reads on Workers.
 */
export interface AuthSecondaryStoragePort {
  get: (key: string) => Promise<string | null | undefined>
  set: (key: string, value: string, ttlMs?: number) => Promise<void>
  delete: (key: string) => Promise<void>
}
