# API runtimes

See [API configuration and secrets](api-configuration.md) for JSONC settings, secrets-only files, and the `bun repo ops vars` commands.

The unified API supports in-memory tests, a local process and a Cloudflare Worker. `apps/api/src/identity` is the only application composition folder allowed to import authentication-provider internals. School business packages remain independent of them.

| Profile | Entry | School database | Account database |
|---|---|---|---|
| Local | `src/entries/local.ts` | `DATABASE_URL`, persisted PGlite by default | `AUTH_DATABASE_URL`, separate persisted PGlite by default |
| In-memory | Test harness | Ephemeral school fixtures | Ephemeral Account fixtures when used |
| Worker | `src/entries/worker.ts` | `HYPERDRIVE` | `HYPERDRIVE_AUTH` |

Local configuration loads `apps/api/config.local.jsonc` plus secrets from `apps/api/.env`; `.dev.vars` belongs to Wrangler. Worker bindings and secrets are parsed without process environment access. Worker database handles are created lazily within each request/runtime, never globally, and closed after the request and required notification work. Process profiles reuse a registry keyed by both database/configuration identities. Authentication dispatch precedes school dependencies; public auth and JWKS do not initialize school repositories unless privileged policy needs them.

`API_ORIGIN` is the environment’s canonical API origin and controls issuer, audience and Account provider base URL. There is no independent auth URL or directory secret. `TRUSTED_ORIGINS` controls credentialed browser CORS. `BETTER_AUTH_SECRET`, durable versioned `ACCOUNT_SECURITY_KEYS` remain secrets; the active key version is non-secret configuration. Worker configuration retains both databases, auth KV, R2, email, browser rendering, queue and cron resources. PGlite is rejected in Worker runtimes.

The scheduled handler runs credential expiry and school scheduling independently and reports either failure after both settle. Queue processing retains its existing school behavior. Maintenance skips HTTP and background work; job pause skips scheduled work and retries queue batches. Cleanup runs even when jobs fail.

Local development uses one API on port 9999 and local files on 9200. The development launcher enables private OTP capture by default; the internal testing entry preserves disposable CI isolation.

Protected school commands retain Zod/OpenAPI body validation, actor resolution, grants and access-token verification. Malformed command bodies return 422; valid bodies without an authorized credential return 401. Auth keeps its own JSON/body-size checks, origin policy and sanitized failures.
