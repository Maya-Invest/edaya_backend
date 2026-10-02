import { readFileSync, writeFileSync } from "node:fs";
import { serve } from "@hono/node-server";
import { parseEnv } from "../src/env";
import { createTestingIdentity } from "./composition";

/** Explicit disposable configuration: never loads or rewrites a project .env. */
export async function startTestingServer(source: Record<string, string | undefined>) {
  if (source.NODE_ENV !== "test")
    throw new Error("The testing server requires NODE_ENV=test");
  const port = Number(source.EDAYA_TEST_PORT ?? 9900);
  const origin = `http://127.0.0.1:${port}`;
  const env = parseEnv({
    NODE_ENV: "test",
    RUNTIME: "test",
    PORT: port,
    LOG_LEVEL: "silent",
    AUTH_DATABASE_URL: source.EDAYA_TEST_AUTH_DATABASE_URL ?? "pglite:memory",
    BETTER_AUTH_SECRET: "disposable-local-testing-secret-at-least-32-characters",
    BETTER_AUTH_URL: origin,
    FIRST_PARTY_API_ORIGINS: source.EDAYA_TEST_API_ORIGIN ?? "http://127.0.0.1:9999",
    TRUSTED_ORIGINS: [`http://localhost:${port}`, origin, `http://10.0.2.2:${port}`, source.EDAYA_TEST_TRUSTED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"].join(","),
    IDENTITY_DIRECTORY_SECRET: source.EDAYA_TEST_DIRECTORY_SECRET ?? "local-directory-secret",
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
  const server = serve({ hostname: "127.0.0.1", port, fetch: request => test.app.fetch(request, env) });
  let closing: Promise<void> | undefined;
  const close = () => closing ??= new Promise<void>((resolve, reject) => server.close(() => {
    void test.close().then(resolve, reject);
  }));
  process.once("SIGTERM", () => {
    void close().then(() => process.exit(0));
  });
  process.once("SIGINT", () => {
    void close().then(() => process.exit(0));
  });
  console.log(`Testing Identity listening on ${origin}`);
  return { close };
}
