import type { AuthSecondaryStoragePort } from '../ports/auth-secondary-storage'

interface StoredValue {
  value: string
  expiresAt?: number
}

export interface InMemoryAuthSecondaryStorage extends AuthSecondaryStoragePort {
  snapshot: () => ReadonlyMap<string, StoredValue>
  clear: () => void
}

export function createInMemoryAuthSecondaryStorage(): InMemoryAuthSecondaryStorage {
  const entries = new Map<string, StoredValue>()

  return {
    async get(key) {
      const entry = entries.get(key)
      if (!entry) {
        return null
      }

      if (entry.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
        entries.delete(key)
        return null
      }

      return entry.value
    },
    async set(key, value, ttlMs) {
      entries.set(key, {
        value,
        ...(ttlMs === undefined ? {} : { expiresAt: Date.now() + ttlMs }),
      })
    },
    async delete(key) {
      entries.delete(key)
    },
    snapshot() {
      return new Map(entries)
    },
    clear() {
      entries.clear()
    },
  }
}
