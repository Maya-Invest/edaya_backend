export type { MigrationDriver } from './lib/migrate'
export { getMigrationsFolder, runMigrations } from './lib/migrate'
export * as authSchema from './schema'
export type { AuthSecondaryStoragePort } from './ports/auth-secondary-storage'
export {
  createInMemoryAuthSecondaryStorage,
  type InMemoryAuthSecondaryStorage,
} from './adapters/in-memory-auth-secondary-storage'
export {
  CLOUDFLARE_KV_MIN_TTL_SECONDS,
  createKvAuthSecondaryStorage,
  isAuthKeyValueStore,
  type AuthKeyValueStore,
} from './adapters/key-value-store'
export {
  BETTER_AUTH_KV_RATE_LIMIT_WINDOW_SECONDS,
  buildBetterAuthRateLimitOptions,
  buildBetterAuthSessionOptions,
  toBetterAuthSecondaryStorage,
  type BetterAuthSecondaryStorageConfig,
} from './better-auth/secondary-storage'
