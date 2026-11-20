/**
 * Public runtime API — prefer importing from `@/runtime`.
 *
 * Process-runtime registry (`getApiRuntime`, `resetApiRuntimesForTests`) lives in
 * `@/runtime/local/registry` so Worker bundles do not pull Bun/SQLite code.
 *
 * Middleware imports `@/runtime/resolve-api-runtime` (tsconfig → local;
 * Wrangler alias → worker).
 */
export {
  type Environment,
  inferRuntimeKind,
  parseEnv,
  parseRuntimeEnv,
  platformBootstrapEmails,
  prepareRuntimeBindings,
  resolveAccountInvitationsEnabled,
  resolveDatabaseUrl,
  resolveInviteBaseUrl,
  resolveRepoLocalDatabaseUrl,
  resolveRepoLocalDataPath,
  resolveRepoRoot,
  resolveWebappOrigin,
  shouldAllowPublicSchoolRegistration,
  usesHyperdriveBinding,
} from "@/runtime/shared/env";

// Process-only helpers are deliberately absent from the shared Worker env barrel.
export { loadDotenvFiles, loadLocalProcessEnv } from "@/runtime/shared/env/local-loader";

export type {
  ApiRuntime,
  DatabaseHandle,
  RuntimeBindings,
  RuntimeKind,
} from "@/runtime/types";
