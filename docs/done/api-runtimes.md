# API runtimes

The API supports two execution runtimes. Configuration is always validated through the same `EnvSchema`; only **how** env values are loaded differs.

| Runtime | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **Node** | `src/entries/node.ts` | `process.env` + optional `.env` (dotenv) | `cd apps/api && bun dev` |
| **Worker** | `src/entries/worker.ts` | Cloudflare bindings (`wrangler.toml` `[vars]` + secrets) | `cd apps/api && bun run dev:worker` |

## Environment variables

Same schema for both runtimes (`apps/api/src/lib/school-api/schemas/openapi/env.schemas.ts`):

| Variable | Node | Worker |
|----------|------|--------|
| `RUNTIME` | `node` (default) | `worker` |
| `DATABASE_URL` | `pglite` for in-memory dev, or `postgres://…` | Postgres URL or Hyperdrive connection string |
| `BETTER_AUTH_SECRET` | `.env` | `.dev.vars` / Worker secret |
| `BETTER_AUTH_URL` | `.env` | `[vars]` or secret |
| `SEED_ON_START` | Auto on `pglite` in dev | Off by default (`pglite` not supported on Worker) |

`dotenv` is **only** used by the Node runtime in non-production environments.

## Node (local dev)

```sh
cp apps/api/.env.example apps/api/.env
cd apps/api && bun dev
```

Production Node containers should inject env vars directly — no `.env` file, `NODE_ENV=production`.

## Worker (Cloudflare)

```sh
cp apps/api/.dev.vars.example apps/api/.dev.vars
cd apps/api && bun run dev:worker
```

- **`wrangler.toml`** — non-secret `[vars]` (`RUNTIME`, `LOG_LEVEL`, …)
- **`.dev.vars`** — local secrets (gitignored), mirrors Worker dashboard secrets in production
- In-memory `pglite` is rejected on the Worker runtime; use a real Postgres connection string

Deploy with `bun run deploy:worker` (`wrangler deploy --env production`) once `BETTER_AUTH_SECRET` is set in the Worker dashboard and migrations are applied to the Hyperdrive origin DB.

## Architecture

```
Request
  └─ Hono app.fetch(request, bindings)
       └─ env middleware → parseRuntimeEnv(bindings)
       └─ schoolApp / auth middleware → getApiRuntime(env)
            └─ createDatabase(env)
            └─ runAuthMigrations ( @edaya/adaptor-betterauth )
            └─ createAuth (Better Auth + authSchema)
            └─ getSchoolApplication → repos.init ( @edaya/adaptor-postgres )
```

Auth schema and SQL migrations live in `packages/adaptor-betterauth`. Runtime Better Auth config lives in `apps/api/src/lib/runtime/create-auth.ts`.

Runtime code lives in `apps/api/src/lib/runtime/`.

### Runtime registry

Always obtain the runtime through `getApiRuntime(env)`. The registry caches one instance per
`RUNTIME` + `DATABASE_URL` pair so middleware, seeds, and handlers share the same database and
auth service. Calling `buildApiRuntime` directly (internal to the registry) creates an uncached
handle that middleware will not see.

### Better Auth proxy

`/auth/*` routes forward to the Better Auth handler. Incoming request URLs are rewritten to
`BETTER_AUTH_URL` before delegation, so a port or host mismatch between the client request and
`BETTER_AUTH_URL` does not break sign-in. Keep `BETTER_AUTH_URL` aligned with the public API URL
in each environment (including reverse proxies).

### Core command HTTP semantics

Protected `POST /api/core/commands/*` routes validate the JSON body with OpenAPI/Zod **before**
the route handler runs. A request with a malformed body therefore returns **422**, even when no
session cookie is present. A well-formed body without a session returns **401**.
