import type { AuthSecondaryStoragePort } from '../ports/auth-secondary-storage'

/** Minimal KV surface so Cloudflare bindings can be adapted without workers-types. */
export interface AuthKeyValueStore {
  get: (key: string) => Promise<string | null>;
  put: (key: string, value: string, options?: { expirationTtl?: number }) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export const CLOUDFLARE_KV_MIN_TTL_SECONDS = 60;

export function resolveKvExpirationTtlSeconds(
  ttlMs: number | undefined,
  minTtlSeconds: number = CLOUDFLARE_KV_MIN_TTL_SECONDS,
): number | undefined {
  if (ttlMs === undefined) {
    return undefined;
  }

  return Math.max(Math.ceil(ttlMs / 1000), minTtlSeconds);
}

export function createKvAuthSecondaryStorage(
  store: AuthKeyValueStore,
  options: { minTtlSeconds?: number } = {},
): AuthSecondaryStoragePort {
  const minTtlSeconds = options.minTtlSeconds ?? CLOUDFLARE_KV_MIN_TTL_SECONDS;

  return {
    get: key => store.get(key),
    set: async (key, value, ttlMs) => {
      const expirationTtl = resolveKvExpirationTtlSeconds(ttlMs, minTtlSeconds);
      await store.put(key, value, expirationTtl === undefined ? undefined : { expirationTtl });
    },
    delete: key => store.delete(key),
  };
}

export function isAuthKeyValueStore(value: unknown): value is AuthKeyValueStore {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<AuthKeyValueStore>;
  return typeof candidate.get === 'function'
    && typeof candidate.put === 'function'
    && typeof candidate.delete === 'function';
}
