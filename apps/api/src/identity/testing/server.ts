import api from "@/app";
import { loadLocalProcessEnv, parseRuntimeEnv } from "@/runtime/shared/env";
import { attachIdentityRuntime } from "../runtime";
import { resetApiRuntimesForTests } from "@/runtime/local/registry";
import { readFileSync, writeFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { parseEnv } from "../env";
import { createTestingIdentity } from "./composition";

/** Explicit disposable configuration: never loads or rewrites a project .env. */
export async function startTestingServer(source: Record<string, string | undefined>) {
  if (source.NODE_ENV !== "test")
    throw new Error("The testing server requires NODE_ENV=test");
  const port = Number(source.EDAYA_TEST_PORT ?? 9999);
  const origin = `http://127.0.0.1:${port}`;
  const env = parseEnv({
    NODE_ENV: "test",
    RUNTIME: "test",
    PORT: port,
    LOG_LEVEL: "silent",
    AUTH_DATABASE_URL: source.EDAYA_TEST_AUTH_DATABASE_URL ?? "pglite:memory",
    BETTER_AUTH_SECRET: "disposable-local-testing-secret-at-least-32-characters",
    BETTER_AUTH_URL: origin,
    FIRST_PARTY_API_ORIGINS: origin,
    TRUSTED_ORIGINS: [`http://localhost:${port}`, origin, `http://10.0.2.2:${port}`, source.EDAYA_TEST_TRUSTED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"].join(","),
  }, "test");
  const clock = source.EDAYA_TEST_CLOCK_FILE;
  const policy = source.EDAYA_TEST_POLICY_FILE;
  if (clock)
    writeFileSync(clock, "0", { mode: 0o600 });
  if (policy)
    writeFileSync(policy, "[]", { mode: 0o600 });
  const test = await createTestingIdentity(env, {
    mailbox: source.EDAYA_TEST_OTP_FILE,
    now: clock
      ? () => {
          const offset = Number(readFileSync(clock, "utf8"));
          if (!Number.isFinite(offset))
            throw new Error("Invalid testing clock");
          return Date.now() + offset;
        }
      : undefined,
    privilegedPolicy: policy
      ? { async requiresTotp(accountId) {
          const accounts: unknown = JSON.parse(readFileSync(policy, "utf8"));
          if (!Array.isArray(accounts) || accounts.some(value => typeof value !== "string"))
            throw new Error("Invalid testing policy");
          return accounts.includes(accountId);
        } }
      : undefined,
  });
  const localEnv = loadLocalProcessEnv();
  const apiEnv = parseRuntimeEnv({ ...localEnv, ...env, LOG_LEVEL: localEnv.LOG_LEVEL ?? "error", RUNTIME: "local", API_ORIGIN: origin, PORT: port });
  attachIdentityRuntime(apiEnv, test.runtime);
  const server = serve({ hostname: "127.0.0.1", port, fetch: (request) => {
    // Private testing routes exist only in this explicitly isolated entry.
    if (new URL(request.url).pathname.startsWith("/auth/edaya/testing/"))
      return test.app.fetch(request, env);
    return api.fetch(request, apiEnv);
  } });
  let closing: Promise<void> | undefined;
  const close = () => closing ??= new Promise<void>((resolve, reject) => server.close(() => {
    void resetApiRuntimesForTests().then(() => test.close()).then(resolve, reject);
  }));
  process.once("SIGTERM", () => {
    void close().then(() => process.exit(0));
  });
  process.once("SIGINT", () => {
    void close().then(() => process.exit(0));
  });
  // eslint-disable-next-line no-console -- Local fixture progress.
  console.log(`Testing API listening on ${origin}`);
  return { close };
}
