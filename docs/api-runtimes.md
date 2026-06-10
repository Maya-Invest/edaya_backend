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

Deploy with `wrangler deploy` once secrets and `DATABASE_URL` are configured in the target environment.

## Architecture

```
Request
  └─ Hono app.fetch(request, bindings)
       └─ env middleware → parseRuntimeEnv(bindings)
       └─ schoolApp / auth middleware → getApiRuntime(env)
            └─ createDatabase(env) + Better Auth + SchoolApplication
```

Runtime code lives in `apps/api/src/lib/runtime/`.
