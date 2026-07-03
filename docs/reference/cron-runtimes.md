# Cron runtimes

Scheduled jobs are defined in `@edaya/core` (`package/domain-core/src/capabilities/scheduling-jobs/`). The API worker runs a **heartbeat** cron via Cloudflare `scheduled()` and executes work through a **Cloudflare Queue** consumer; local dev uses a one-shot entry with inline execution.

| Profile | Entry | Env source | Command |
|---------|-------|------------|---------|
| **local** | `apps/api/src/entries/cron-local.ts` | `process.env` + `.env` (same as API local) | `bun dev:cron` (root) |
| **worker** | `apps/api/src/entries/worker.ts` (`scheduled` + `queue`) | Cloudflare bindings (`wrangler.jsonc` + secrets) | deploy with API (`bun run deploy:api`) |

## Environment variables

Uses the API `EnvSchema` (`apps/api/src/runtime/shared/env/schema.ts`).

| Variable | local (`bun dev:cron`) | worker (`scheduled`) |
|----------|------------------------|----------------------|
| `RUNTIME` | `local` | `worker` |
| `DATABASE_URL` | `pglite:.data/school` | Hyperdrive `connectionString` |
| `NOVU_SECRET_KEY` | optional `.env` | `.dev.vars` / Worker secret |
| `CRON_JOB_KEYS` | optional comma-separated filter (bypasses schedule table) | N/A |

Worker bindings (not env vars):

| Binding | Role |
|---------|------|
| `CRON_JOBS` | Queue producer (heartbeat) and consumer (`queue` handler) |

Local cron uses the full API local runtime (school PGlite, auth SQLite, local-files, Novu when configured).

## Local (dev / CI)

```sh
bun run dev:cron
```

Runs one heartbeat tick: loads due rows from `cron_job_schedules`, dispatches each `(jobKey, schoolId)` **inline**, and advances `next_run_at`.

Optional filter (bypasses the schedule table and runs handlers directly):

```sh
CRON_JOB_KEYS=reconcilePendingDeliveries bun run dev:cron
```

## Worker (Cloudflare)

A single heartbeat trigger is declared in `apps/api/wrangler.jsonc`:

| Cron expression | Role |
|-----------------|------|
| `*/5 * * * *` | Heartbeat — loads due schedules from Postgres and enqueues work |

Job schedules live in the `cron_job_schedules` table (seeded by migration `0035_cron_job_schedules.sql`):

| `job_key` | `cron_expression` |
|-----------|-------------------|
| `expireAccountInvitations` | `0 2 * * *` |
| `processDueNotifications` | `0 6 * * *` |
| `reconcilePendingDeliveries` | `*/5 * * * *` |

Queue names per deploy profile:

| Profile | Queue |
|---------|-------|
| default / worker-local | `edaya-cron-jobs` |
| staging | `edaya-cron-jobs-staging` |
| production | `edaya-cron-jobs-production` |

Queues are created automatically on first deploy with the queue bindings in `wrangler.jsonc`.

Deploy with the API worker:

```sh
bun run deploy:api          # production
bun run deploy:api:staging  # staging
```

After first deploy with merged cron, remove legacy `edaya-cron` workers in Cloudflare to avoid duplicate schedules.

## Architecture

```
heartbeat (scheduled) or cron-local main()
  └─ build*ApiRuntime(env)
       └─ tickCronSchedules()
            ├─ CronJobSchedulePort.listDue(asOf)     // Postgres
            ├─ CronJobDispatcherPort.dispatch(...)   // inline (local) or CRON_JOBS queue (worker)
            └─ markDispatched(next_run_at)

queue consumer (worker only)
  └─ runCronJobForSchool(app, { jobKey, schoolId })   // @edaya/core
```

Structured log events: `cron.tick`, `cron.dispatch`, `cron.execute`.

Job catalog: `package/domain-core/src/capabilities/scheduling-jobs/cron-job-catalog.ts`. Add new jobs in core, register in `cron-job-runner.ts`, and insert a row into `cron_job_schedules`.

## Operations

### Cloudflare cleanup (one-time)

After deploying the merged API worker with heartbeat + queue:

1. In the Cloudflare dashboard, delete standalone Workers named `edaya-cron` / `edaya-cron-staging` if they still exist.
2. Confirm only `edaya-api` / `edaya-api-staging` have a `*/5 * * * *` cron trigger.
3. Verify queue consumers are attached to the API worker (Queues → `edaya-cron-jobs*`).

`bun run doctor` enforces a single heartbeat cron and `CRON_JOBS` queue binding in `wrangler.jsonc`.

### Schedule changes without redeploy

Update rows in `cron_job_schedules` (expressions are UTC):

```sql
-- Disable a job temporarily
UPDATE cron_job_schedules
SET enabled = false, updated_at = NOW()
WHERE job_key = 'reconcilePendingDeliveries';

-- Shift the next run (e.g. after an incident)
UPDATE cron_job_schedules
SET next_run_at = NOW() + INTERVAL '5 minutes', updated_at = NOW()
WHERE job_key = 'processDueNotifications';
```

Handlers remain in code; the table only controls **when** jobs run.

See also: [cron-heartbeat-dispatcher-plan.md](../sprints/cron-heartbeat-dispatcher-plan.md), [api-runtimes.md](./api-runtimes.md).
