# Cron runtimes

Scheduled jobs are defined in `@edaya/core` (`package/domain-core/src/cron/`). `apps/cron` is a thin runtime shell — same structural pattern as `apps/api`.

| Profile | Entry | Env source | Local command |
|---------|-------|------------|---------------|
| **local** | `src/entries/local.ts` | `process.env` + optional `.env` (dotenv) | `cd apps/cron && bun dev` or `bun run dev:cron` (root) |
| **worker** | `src/entries/worker.ts` | Cloudflare bindings (`wrangler.toml` `[vars]` + secrets) | `cd apps/cron && bun run dev:worker` |

## Environment variables

Same schema for both profiles (`apps/cron/src/runtime/shared/env/schema.ts`):

| Variable | local | worker |
|----------|-------|--------|
| `RUNTIME` | `local` (default) | `worker` |
| `DATABASE_URL` | `pglite:.data/school` (persisted dev), `pglite` (in-memory), or `postgres://…` | Hyperdrive `connectionString` (preferred) or `DATABASE_URL` fallback |
| `LOG_LEVEL` | `.env` | `[vars]` |
| `RUN_MIGRATIONS_ON_STARTUP` | optional override | N/A (migrations pre-applied) |
| `CRON_JOB_KEYS` | optional comma-separated filter | N/A (resolved from cron trigger) |

No auth database — cron only needs the school Postgres/PGlite connection.

## Local (dev / CI)

```sh
cp apps/cron/.env.example apps/cron/.env   # optional — falls back to apps/api/.env
cd apps/cron && bun dev
```

Or from the repo root: `bun run dev:cron`.

Runs all registered cron jobs once and exits. School DB migrations run on startup for PGlite (same as API local profile).

## Worker (Cloudflare)

```sh
cp apps/api/.dev.vars apps/cron/.dev.vars   # reuse Hyperdrive local connection string
cd apps/cron && bun run dev:worker
```

- **`wrangler.toml`** — `[vars]`, Hyperdrive binding, `[[triggers]]` crons
- **School DB** — Postgres via Hyperdrive (migrations pre-applied to origin DB)

Deploy: `bun run deploy:cron` (production) or `bun run deploy:cron:staging`.

## Architecture

```
scheduled event (worker) or main() (local)
  └─ build*CronRuntime(env)
       └─ SchoolApplication (school DB only)
            └─ runCronJobs(application, { asOf })   // @edaya/core
                 └─ per school × job key handlers
```

Job catalog: `package/domain-core/src/cron/cron-job-catalog.ts`. Add new jobs in core, register in `cron-job-runner.ts`; the app layer stays unchanged.

See also: [api-runtimes.md](./api-runtimes.md) for shared env/Hyperdrive patterns.
