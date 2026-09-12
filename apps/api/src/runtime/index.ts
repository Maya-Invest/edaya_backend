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
  loadDotenvFiles,
  loadLocalProcessEnv,
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

export type {
  ApiRuntime,
  DatabaseHandle,
  RuntimeBindings,
  RuntimeKind,
} from "@/runtime/types";
