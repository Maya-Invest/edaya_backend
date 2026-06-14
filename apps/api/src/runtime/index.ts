/**
 * Public runtime API — prefer importing from `@/runtime`.
 *
 * Exception: middleware uses `@/runtime/resolve/api-runtime` so Wrangler can
 * alias the Worker implementation (`wrangler.toml` `[alias]`).
 */
export {
  type Environment,
  inferRuntimeKind,
  parseEnv,
  parseRuntimeEnv,
  prepareRuntimeBindings,
  resolveDatabaseUrl,
  usesHyperdriveBinding,
} from "@/runtime/env";

export { loadDotenvFiles, loadNodeProcessEnv } from "@/runtime/env/node-loader";

export {
  shouldAllowPublicSchoolRegistration,
} from "@/runtime/feature-flags";

export {
  getApiRuntime,
  resetApiRuntimesForTests,
} from "@/runtime/registry";

export { createAuth } from "@/runtime/shared/create-auth";

export type {
  ApiRuntime,
  AuthService,
  DatabaseHandle,
  RuntimeBindings,
  RuntimeKind,
} from "@/runtime/types";
