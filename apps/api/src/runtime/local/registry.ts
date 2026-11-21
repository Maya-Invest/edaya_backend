import { buildInMemoryApiRuntime } from "@/runtime/in-memory/build-runtime";
import { buildLocalApiRuntime } from "@/runtime/local/build-runtime";
import { createRuntimeRegistry } from "@/runtime/shared/process-registry";
import { runMigrationsOnStartup as localRunMigrationsOnStartup } from "@/runtime/local/profile";
import type { Environment } from "@/runtime/shared/env/schema";
import type { ApiRuntime } from "@/runtime/types";

function runMigrationsOnStartup(env: Environment): boolean {
  if (env.RUNTIME === "in-memory") {
    return true;
  }
  return localRunMigrationsOnStartup(env);
}

async function buildProcessApiRuntime(env: Environment): Promise<ApiRuntime> {
  return env.RUNTIME === "in-memory"
    ? buildInMemoryApiRuntime(env)
    : buildLocalApiRuntime(env);
}

const runtimeRegistry = createRuntimeRegistry<Environment, ApiRuntime>({
  buildRuntime: buildProcessApiRuntime,
  closeRuntime: runtime => runtime.close(),
  cacheKey: env => [
    env.RUNTIME,
    env.SCHEDULER_MODE,
    env.DATABASE_URL,
    env.AUTH_DATABASE_URL,
    env.API_ORIGIN,
    env.BETTER_AUTH_SECRET,
    env.PHONE_AUTH_MODE,
    JSON.stringify(env.SMS_ROUTES),
    env.SMS_TRANSPORT,
    env.AFRICAS_TALKING_USERNAME,
    env.AFRICAS_TALKING_SENDER_ID,
    env.AFRICAS_TALKING_SANDBOX,
    env.AFRICAS_TALKING_API_KEY,
    env.REQUIRE_PRIVILEGED_TOTP,
    env.ACCOUNT_SECURITY_KEYS,
    env.ACCOUNT_SECURITY_KEY_VERSION,
    runMigrationsOnStartup(env),
  ].join(":"),
  workerErrorMessage: "getApiRuntime() must not be used on the worker runtime; use resolveApiRuntime(c) per request.",
});

/** Returns the shared API runtime for in-memory and local profiles. */
export const getApiRuntime = runtimeRegistry.get;

/** Closes cached runtimes and clears the registry (test teardown). */
export async function resetApiRuntimesForTests(): Promise<void> {
  await runtimeRegistry.reset();
}
