# API runtimes

The API runs as one of three **profiles**: `in-memory`, `local`, or `worker`. Each profile declares which adapters to wire (school DB, auth DB, file storage, notifications). Configuration is validated through the same `EnvSchema`; only **how** env values are loaded differs.

**Contract:** [runtime-boundaries.md](./runtime-boundaries.md) — adapter matrix and bootstrap rules.

Scheduled cron jobs run on the API worker (`scheduled()` handler). See [cron-runtimes.md](./cron-runtimes.md).

| Profile | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **local** | `src/entries/local.ts` | `process.env` + optional `.env` (dotenv) | `bun dev` (root) |
| **in-memory** | *(tests only)* | harness env | `bun test` in `apps/api` |
| **worker** | `src/entries/worker.ts` | Cloudflare bindings (`wrangler.jsonc` `vars` + secrets) | `bun dev:worker:staging` (optional) |

## Environment variables

Same schema for all profiles (`apps/api/src/runtime/shared/env/schema.ts`):

| Variable | in-memory / local | worker |
|----------|-------------------|--------|
| `RUNTIME` | `in-memory` or `local` (default `local`) | `worker` |
| `DATABASE_URL` | `pglite:.data/school` (local persisted), `pglite` (in-memory) | Hyperdrive `connectionString` (preferred) or `DATABASE_URL` fallback |
| `RUN_MIGRATIONS_ON_STARTUP` | Optional on `local`; defaults on for PGlite | N/A — migrations are pre-applied |
| `BETTER_AUTH_SECRET` | `.env` | Worker secret (`.dev.vars` / dashboard) |
| `BETTER_AUTH_URL` | `.env` | `[vars]` or secret |
| `TRUSTED_ORIGINS` | `.env` (comma-separated) | `[vars]` |
| `COOKIE_DOMAIN` | optional `.env` | `[vars]` (production split-domain) |
| `GRANTS_CACHE_TTL_MS` | optional `.env` | optional secret / `[vars]` |
| `ALLOW_PUBLIC_SCHOOL_REGISTRATION` | optional; defaults on in `development` | `[vars]` |
| `LOCAL_FILES_*` | local profile only | ignored |

`dotenv` is **only** used by process profiles (`local` / `in-memory`) in non-production environments (`runtime/shared/env/local-loader.ts`), loading **`apps/api/.env` only**.

On Worker, `prepareRuntimeBindings()` resolves `DATABASE_URL` from the Hyperdrive binding when present (`runtime/shared/env/hyperdrive.ts`). Any `pglite` / `file://` URL is rejected on Worker.

## Profile adapters

| Adapter | in-memory | local | worker |
|---------|-----------|-------|--------|
| School DB | PGlite (ephemeral) | PGlite persisted (`.data/school`) | Postgres via Hyperdrive |
| Auth DB | PGlite `auth` schema | PGlite `auth` schema (same DB) | Postgres `auth` schema via Hyperdrive |
| Migrations on startup | yes | yes (PGlite default) | no |
| File storage | in-memory port | `@edaya/adaptor-local-fs` + `bun dev` | R2 (required) |
| Notifications | no-op | Novu* or log/no-op | Novu* or no-op |

\*Novu is the documented vendor exception on `local` and `worker`. See [runtime-boundaries.md](./runtime-boundaries.md).

Bootstrap resolvers do not upgrade adaptors when unrelated vendor env vars are present.

## Local dev

```sh
cp apps/api/.env.example apps/api/.env
bun dev
```

Set `RUNTIME=local` (default). `bun dev` starts the API and `@edaya/local-files` together. School data and auth SQLite live under repo-root `.data/` (gitignored).

Production containers using the local entry should inject env vars directly — no `.env` file, `NODE_ENV=production`.

## Worker (Cloudflare)

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
cd apps/api && bun run dev:worker:staging
```

worker smoke uses the same adapter wiring as production (`RUNTIME=worker` via Miniflare).

- **`wrangler.jsonc`** — non-secret `vars` (`RUNTIME`, `LOG_LEVEL`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, …), Hyperdrive binding
- **`.dev.vars`** — Wrangler-only secrets (gitignored); loaded by `wrangler dev --env-file` and deploy — **not** by `bun dev`
- **School + auth DB** — Postgres via Hyperdrive binding (set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `.dev.vars` for local wrangler dev); auth tables in the `auth` schema

Deploy with `bun run deploy:api` (root) or `bun run deploy:worker` in `apps/api` (`wrangler deploy --env production`) once `BETTER_AUTH_SECRET` is set in the Worker dashboard and migrations are applied to the Hyperdrive origin DB (school + `auth` schema).

**Staging:** `bun run deploy:api:staging` deploys `[env.staging]` (`edaya-api-staging`). Use separate Hyperdrive and secrets from production. Full runbook: [deploy-staging.md](./deploy-staging.md).

## Architecture

```
Request
  └─ Hono app.fetch(request, bindings)
       └─ dependencies middleware (http/dependencies/)
            ├─ env → parseRuntimeEnv(prepareRuntimeBindings)
            ├─ school runtime → getApiRuntime (process) or resolveApiRuntime (worker)
            ├─ auth → createAuth from runtime/shared/create-auth.ts
            └─ session actor → effective grants
       └─ route handler → SchoolApplication / Better Auth handler
```

| Concern | in-memory / local | worker |
|---------|-------------------|--------|
| School DB | `in-memory/school-database.ts`, `local/school-database.ts` | `worker/school-database.ts` |
| Auth DB | `in-memory/auth-database.ts`, `local/auth-database.ts` | `worker/auth-database.ts` |
| Runtime cache | `local/registry.ts` — `getApiRuntime(env)` | `worker/resolve-api-runtime.ts` per request |

Auth schema and SQL migrations live in `package/adaptor-auth`. Migration CLI lives in `tooling/db-migrate`. Runtime Better Auth config lives in `apps/api/src/runtime/shared/create-auth.ts`.

Folder map: `apps/api/src/runtime/README.md`.

### Runtime registry (process profiles)

Always obtain process runtimes through `getApiRuntime(env)`. The registry caches one instance per profile + database key so middleware, seeds, and handlers share the same database and auth service. Calling `buildProcessApiRuntime` directly creates an uncached handle that middleware will not see.

On Worker, use `resolveApiRuntime(c)` — each request gets a runtime that is closed in the dependency middleware's `onRequestComplete` hook.

### Better Auth proxy

`/auth/*` routes forward to the Better Auth handler. Incoming request URLs are rewritten to `BETTER_AUTH_URL` before delegation, so a port or host mismatch between the client request and `BETTER_AUTH_URL` does not break sign-in. Keep `BETTER_AUTH_URL` aligned with the public API URL in each environment (including reverse proxies).

`TRUSTED_ORIGINS` must include the webapp origin when the browser calls the API cross-origin (production split-domain). In local dev, the webapp Vite proxy keeps requests same-origin.

### Core command HTTP semantics

Protected `POST /core/commands/*` routes validate the JSON body with OpenAPI/Zod **before** the route handler runs. A request with a malformed body therefore returns **422**, even when no session cookie is present. A well-formed body without a session returns **401**.
