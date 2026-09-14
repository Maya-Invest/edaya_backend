# API runtimes

The API runs as one of three **profiles**: `in-memory`, `local`, or `worker`. Each profile declares which adapters to wire (school DB, identity client, file storage, notifications). Configuration is validated through the same `EnvSchema`; only **how** env values are loaded differs.

**Contract:** [runtime-boundaries.md](./runtime-boundaries.md) — adapter matrix and bootstrap rules.

Scheduled cron jobs run on the API worker (`scheduled()` handler). See [cron-runtimes.md](./cron-runtimes.md).

| Profile | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **local** | `src/entries/local.ts` | `process.env` + optional `.env` (dotenv) | `bun repo dev` (root) |
| **in-memory** | *(tests only)* | harness env | `bun test` in `apps/api` |
| **worker** | `src/entries/worker.ts` | Cloudflare bindings (`wrangler.jsonc` `vars` + secrets) | `bun --filter @edaya/api dev:worker` (optional) |

## Environment variables

Same schema for all profiles (`apps/api/src/runtime/shared/env/schema.ts`):

| Variable | in-memory / local | worker |
|----------|-------------------|--------|
| `RUNTIME` | `in-memory` or `local` (default `local`) | `worker` |
| `DATABASE_URL` | `pglite:.data/school` (local persisted), `pglite` (in-memory) | Hyperdrive `connectionString` (preferred) or `DATABASE_URL` fallback |
| `RUN_MIGRATIONS_ON_STARTUP` | Optional on `local`; defaults on for PGlite | N/A — migrations are pre-applied |
| `API_ORIGIN` | `http://localhost:9999` | `[vars]` |
| `IDENTITY_ISSUER` | `http://localhost:9900` | `[vars]` |
| `IDENTITY_DIRECTORY_URL` | `http://localhost:9900` | `[vars]` or `IDENTITY` service binding |
| `IDENTITY_DIRECTORY_SECRET` | `.env` | Worker secret (`.dev.vars` / dashboard) |
| `TRUSTED_ORIGINS` | `.env` (comma-separated) | `[vars]` |
| `ALLOW_PUBLIC_SCHOOL_REGISTRATION` | optional; defaults on in `development` | `[vars]` |
| `LOCAL_FILES_*` | local profile only | ignored |

`dotenv` is **only** used by process profiles (`local` / `in-memory`) in non-production environments (`runtime/shared/env/local-loader.ts`), loading **`apps/api/.env` only**.

On Worker, `prepareRuntimeBindings()` resolves `DATABASE_URL` from the Hyperdrive binding when present (`runtime/shared/env/hyperdrive.ts`). Any `pglite` / `file://` URL is rejected on Worker.

## Profile adapters

| Adapter | in-memory | local | worker |
|---------|-----------|-------|--------|
| School DB | PGlite (ephemeral) | PGlite persisted (`.data/school`) | Postgres via Hyperdrive |
| Identity | Fixture client | HTTP identity client | HTTP/service-binding directory + issuer JWKS |
| Migrations on startup | yes | yes (PGlite default) | no |
| File storage | in-memory port | `@edaya/adaptor-local-fs` + `bun repo dev` | R2 (required) |
| Notifications | no-op | in-process notify (log email + log SMS) | in-process notify (Cloudflare email + unimplemented SMS) + FCM |
| Document rendering | not configured | stub or Gotenberg | Browser Run or Gotenberg |

\*Notify is in-process `@edaya/adaptor-notify` with email/SMS injected by `apps/api`. Document rendering is in-process `@edaya/adaptor-docs`. See [runtime-boundaries.md](./runtime-boundaries.md).

Bootstrap resolvers do not upgrade adaptors when unrelated vendor env vars are present.

## Local dev

```sh
cp apps/api/.env.example apps/api/.env
bun repo dev
```

Set `RUNTIME=local` (default). `bun repo dev` starts the school API and `@edaya/local-files-server` together. Start sibling `edaya_identity` separately on port 9900; it owns its own database. In-process notify uses the school PGlite `notify` schema and log email by default.

Production containers using the local entry should inject env vars directly — no `.env` file, `NODE_ENV=production`.

## Worker (Cloudflare)

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
cd apps/api && bun run dev:worker
```

worker smoke uses the same adapter wiring as production (`RUNTIME=worker` via Miniflare).

- **`wrangler.jsonc`** — non-secret `vars` (`RUNTIME`, `LOG_LEVEL`, identity origins, `TRUSTED_ORIGINS`, …), school Hyperdrive and optional identity service bindings
- **`.dev.vars`** — Wrangler-only secrets (gitignored); loaded by `wrangler dev --env-file` and deploy — **not** by `bun repo dev`
- **School DB** — Postgres via `HYPERDRIVE` (set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` in `.dev.vars` for local worker dev)

Deploy with `bun repo deploy api production` (root) or `bun run deploy:production` in `apps/api` (`wrangler deploy --env prod`) once `IDENTITY_DIRECTORY_SECRET` is set in the Worker dashboard, Central Identity is deployed, and school migrations are applied.

**Staging:** `bun repo deploy api staging` deploys `[env.staging]` (`edaya-api-staging`). Use separate Hyperdrive and secrets from production. Full runbook: [deploy-staging.md](./deploy-staging.md).

## Architecture

```
Request
  └─ Hono app.fetch(request, bindings)
       └─ dependencies middleware (http/dependencies/)
            ├─ env → parseRuntimeEnv(prepareRuntimeBindings)
            ├─ school runtime → getApiRuntime (process) or resolveApiRuntime (worker)
            ├─ identity client → JWT verification + directory API
            └─ session actor → effective grants
       └─ route handler → SchoolApplication
```

| Concern | in-memory / local | worker |
|---------|-------------------|--------|
| School DB | `in-memory/school-database.ts`, `local/school-database.ts` | `worker/school-database.ts` |
| Runtime cache | `local/registry.ts` — `getApiRuntime(env)` | `worker/resolve-api-runtime.ts` per request |

Identity persistence and authentication runtime live in sibling `edaya_identity`. The school migration CLI in `tooling/db-migrate` applies only the school schema.

Folder map: `apps/api/src/runtime/README.md`.

### Runtime registry (process profiles)

Always obtain process runtimes through `getApiRuntime(env)`. The registry caches one instance per profile + database key so middleware, seeds, and handlers share the same school database and identity client. Calling `buildProcessApiRuntime` directly creates an uncached handle that middleware will not see.

On Worker, use `resolveApiRuntime(c)` — each request gets a runtime that is closed in the dependency middleware's `onRequestComplete` hook.

### Central Identity

The school API does not mount `/auth/*`. Clients authenticate against `IDENTITY_ISSUER`, then send the resulting access JWT to school routes with `Authorization: Bearer …`. Cookies never authenticate school routes.

`TRUSTED_ORIGINS` must include the webapp origin when the browser calls the API cross-origin (production split-domain). In local dev, the webapp Vite proxy keeps requests same-origin.

### Core command HTTP semantics

Protected `POST /core/commands/*` routes validate the JSON body with OpenAPI/Zod **before** the route handler runs. A malformed body therefore returns **422** before authentication is evaluated. A well-formed body without a valid Bearer credential returns **401**.
