import { parseEnv } from "../env";

/** Allowlist email settings; ordinary local identity settings must stay isolated. */
export function parseTestingEnv(source: Record<string, string | undefined>, emailSource: Record<string, unknown>) {
  const port = Number(source.EDAYA_TEST_PORT ?? 9999);
  const origin = `http://127.0.0.1:${port}`;
  return parseEnv({
    ALLOW_PUBLIC_ACCOUNT_REGISTRATION: source.ALLOW_PUBLIC_ACCOUNT_REGISTRATION ?? true,
    NODE_ENV: "test",
    RUNTIME: "test",
    PORT: port,
    LOG_LEVEL: "silent",
    AUTH_DATABASE_URL: source.EDAYA_TEST_AUTH_DATABASE_URL ?? "pglite:memory",
    BETTER_AUTH_SECRET: "disposable-local-testing-secret-at-least-32-characters",
    BETTER_AUTH_URL: origin,
    FIRST_PARTY_API_ORIGINS: origin,
    TRUSTED_ORIGINS: [`http://localhost:${port}`, origin, `http://10.0.2.2:${port}`, source.EDAYA_TEST_TRUSTED_ORIGINS ?? "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173"].join(","),
    EMAIL_TRANSPORT: emailSource.EMAIL_TRANSPORT,
    EMAIL_FROM: emailSource.EMAIL_FROM,
    CLOUDFLARE_EMAIL_ACCOUNT_ID: emailSource.CLOUDFLARE_EMAIL_ACCOUNT_ID,
    CLOUDFLARE_EMAIL_API_TOKEN: emailSource.CLOUDFLARE_EMAIL_API_TOKEN,
  }, "test");
}
