# API runtimes

The API supports two execution runtimes. Configuration is always validated through the same `EnvSchema`; only **how** env values are loaded differs.

| Runtime | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **Node** | `src/entries/node.ts` | `process.env` + optional `.env` (dotenv) | `cd apps/api && bun dev` |
| **Worker** | `src/entries/worker.ts` | Cloudflare bindings (`wrangler.toml` `[vars]` + secrets) | `cd apps/api && bun run dev:worker` |

## Environment variables

Same schema for both runtimes (`apps/api/src/runtime/env/schema.ts`):

| Variable | Node | Worker |
|----------|------|--------|
| `RUNTIME` | `node` (default) | `worker` |
| `DATABASE_URL` | `pglite:.data/school` (persisted dev), `pglite` (in-memory), or `postgres://…` | Hyperdrive `connectionString` (preferred) or `DATABASE_URL` fallback |
| `AUTH_DATABASE_PATH` | `.data/auth.sqlite` (default) | N/A — uses `AUTH_DB` D1 binding |
| `BETTER_AUTH_SECRET` | `.env` | `.dev.vars` / Worker secret |
| `BETTER_AUTH_URL` | `.env` | `[vars]` or secret |
| `TRUSTED_ORIGINS` | `.env` (comma-separated) | `[vars]` |
| `COOKIE_DOMAIN` | optional `.env` | `[vars]` (production split-domain) |
| `SERVICE_ACCOUNT_API_KEY` | optional `.env` — HTTP seeding via `/core/*` | Worker secret |
| `GRANTS_CACHE_TTL_MS` | optional `.env` | optional secret / `[vars]` |
| `ALLOW_PUBLIC_SCHOOL_REGISTRATION` | optional; defaults on in `development` | `[vars]` |

`dotenv` is **only** used by the Node runtime in non-production environments (`runtime/env/node-loader.ts`).

On Worker, `prepareRuntimeBindings()` resolves `DATABASE_URL` from the Hyperdrive binding when present (`runtime/env/hyperdrive.ts`). Any `pglite` / `file://` URL is rejected on Worker.

## Node (local dev)

```sh
cp apps/api/.env.example apps/api/.env
cd apps/api && bun dev
```

- **School DB** — PGlite (persisted or in-memory) or Postgres via `@edaya/adaptor-postgres`; migrations run on startup.
- **Auth DB** — local SQLite at `AUTH_DATABASE_PATH`; migrations from `@edaya/betterauth-d1-migrations` run on startup.

Production Node containers should inject env vars directly — no `.env` file, `NODE_ENV=production`.

## Worker (Cloudflare)

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
cd apps/api && bun run dev:worker
```

- **`wrangler.toml`** — non-secret `[vars]` (`RUNTIME`, `LOG_LEVEL`, `BETTER_AUTH_URL`, `TRUSTED_ORIGINS`, …), Hyperdrive + D1 bindings
- **`.dev.vars`** — local secrets (gitignored), mirrors Worker dashboard secrets in production
- **School DB** — Postgres connection via Hyperdrive binding (set `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` for local wrangler dev)
- **Auth DB** — D1 binding `AUTH_DB`; SQL migrations in `integrations/betterauth-d1-migrations/drizzle/`

Deploy with `bun run deploy:api` (root) or `bun run deploy:worker` in `apps/api` (`wrangler deploy --env production`) once `BETTER_AUTH_SECRET` is set in the Worker dashboard and migrations are applied to the Hyperdrive origin DB and D1.

## Architecture

```
Request
  └─ Hono app.fetch(request, bindings)
       └─ dependencies middleware (http/dependencies/)
            ├─ env → parseRuntimeEnv(prepareRuntimeBindings)
            ├─ school runtime → getApiRuntime (Node) or resolveApiRuntime (Worker)
            ├─ auth → createAuth from runtime/shared/create-auth.ts
            └─ session actor → effective grants
       └─ route handler → SchoolApplication / Better Auth handler
```

| Concern | Node | Worker |
|---------|------|--------|
| School DB | PGlite or Postgres (`node/database.ts`; migrations on startup) | Postgres via Hyperdrive (`worker/database.ts`; migrations pre-applied) |
| Auth DB | SQLite file (`node/auth-database.ts`) | D1 (`worker/auth-database.ts`) |
| Runtime cache | Process registry — `getApiRuntime(env)` | Per-request — `resolveApiRuntime(c)` |

Auth schema and SQL migrations live in `integrations/betterauth-d1-migrations`. School migration apply scripts live in `integrations/neon-migrations`. Runtime Better Auth config lives in `apps/api/src/runtime/shared/create-auth.ts`.

Folder map: `apps/api/src/runtime/README.md`.

### Runtime registry (Node)

Always obtain the Node runtime through `getApiRuntime(env)`. The registry caches one instance per `RUNTIME` + `DATABASE_URL` pair so middleware, seeds, and handlers share the same database and auth service. Calling `buildNodeApiRuntime` directly creates an uncached handle that middleware will not see.

On Worker, use `resolveApiRuntime(c)` — each request gets a runtime that is closed in the dependency middleware's `onRequestComplete` hook.

### Better Auth proxy

`/auth/*` routes forward to the Better Auth handler. Incoming request URLs are rewritten to `BETTER_AUTH_URL` before delegation, so a port or host mismatch between the client request and `BETTER_AUTH_URL` does not break sign-in. Keep `BETTER_AUTH_URL` aligned with the public API URL in each environment (including reverse proxies).

`TRUSTED_ORIGINS` must include the webapp origin when the browser calls the API cross-origin (production split-domain). In local dev, the webapp Vite proxy keeps requests same-origin.

### Core command HTTP semantics

Protected `POST /core/commands/*` routes validate the JSON body with OpenAPI/Zod **before** the route handler runs. A request with a malformed body therefore returns **422**, even when no session cookie is present. A well-formed body without a session returns **401**.
