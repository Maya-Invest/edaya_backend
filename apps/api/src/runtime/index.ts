export {
  getApiRuntime,
  resetApiRuntimesForTests,
} from "@/runtime/local/registry";

export { createBetterAuth } from "@/runtime/shared/adapters/better-auth";

/**
 * Public runtime API — prefer importing from `@/runtime`.
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
  prepareRuntimeBindings,
  resolveAccountInvitationsEnabled,
  resolveDatabaseUrl,
  resolveInviteBaseUrl,
  resolveRepoLocalDatabaseUrl,
  resolveRepoLocalDataPath,
  resolveRepoRoot,
  shouldAllowPublicSchoolRegistration,
  usesHyperdriveBinding,
} from "@/runtime/shared/env";

export type {
  ApiRuntime,
  AuthService,
  DatabaseHandle,
  RuntimeBindings,
  RuntimeKind,
} from "@/runtime/types";
