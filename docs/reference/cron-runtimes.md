# Cron runtimes

Scheduled jobs are defined in `@edaya/core` (`package/domain-core/src/capabilities/scheduling-jobs/`). Deployed workers run a **heartbeat** cron via Cloudflare `scheduled()` and execute work through a **Cloudflare Queue** consumer. Local debugging uses a one-shot CLI against the same PGlite database as `bun repo dev`.

| Profile | Entry | Env source | Command |
|---------|-------|------------|---------|
| **local** | `apps/api/src/entries/cron-local.ts` | `apps/api/.env` | `bun cron:local` (root) |
| **worker** | `apps/api/src/entries/worker.ts` (`scheduled` + `queue`) | `wrangler.jsonc` + Wrangler secrets | `bun repo deploy api production`, `bun repo deploy api staging` |

## Environment variables

Uses the API `EnvSchema` (`apps/api/src/runtime/shared/env/schema.ts`).

| Variable | local (`bun cron:local`) | worker (`scheduled`) |
|----------|--------------------------|----------------------|
| `RUNTIME` | `local` | `worker` |
| `DATABASE_URL` | `pglite:.data/school` | Hyperdrive `connectionString` |
| `NOVU_SECRET_KEY` | optional `.env` | Wrangler secret |
| `CRON_JOB_KEYS` | optional comma-separated filter (bypasses schedule table) | N/A |

Worker bindings (not env vars):

| Binding | Role |
|---------|------|
| `CRON_JOBS` | Queue producer (heartbeat) and consumer (`queue` handler) |

Local cron uses the same PGlite school DB and `auth` schema as `bun repo dev`. Novu is optional (from `.env`). File storage uses `@edaya/adaptor-local-fs` when `LOCAL_FILES_*` is set in `.env`.

## Local (one-shot against PGlite)

Requires a seeded local database (`bun repo dev` at least once, or `bun repo seed` with API running).

```sh
bun --filter @edaya/api cron:local
```

Runs one heartbeat tick: loads due rows from `cron_job_schedules`, dispatches each `(jobKey, schoolId)` **inline**, and advances `next_run_at`.

Optional filter (bypasses the schedule table and runs handlers directly):

```sh
CRON_JOB_KEYS=reconcilePendingDeliveries bun --filter @edaya/api cron:local
```

## Worker (Cloudflare)

A single heartbeat trigger is declared per deploy profile in `apps/api/wrangler.jsonc`:

| Cron expression | Role |
|-----------------|------|
| `*/5 * * * *` | Heartbeat — loads due schedules from Postgres and enqueues work |

Job schedules live in the `cron_job_schedules` table (seeded after school migrations via `seedCronJobSchedules`):

| `job_key` | `cron_expression` |
|-----------|-------------------|
| `expireAccountInvitations` | `0 2 * * *` |
| `processDueNotifications` | `0 6 * * *` |
| `reconcilePendingDeliveries` | `*/5 * * * *` |

Queue names per deploy profile:

| Profile | Queue |
|---------|-------|
| staging | `edaya-cron-jobs-staging` |
| production | `edaya-cron-jobs-prod` |

Deploy with the API worker:

```sh
bun repo deploy api staging    # staging
bun repo deploy api production # production
```

## Architecture

```
heartbeat (scheduled) or cron-local main()
  └─ build*ApiRuntime(env)
       └─ tickCronSchedules()
            ├─ CronJobSchedulePort.listDue(asOf)     // Postgres / PGlite
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
2. Confirm only `edaya-api-staging` / `edaya-api-prod` have a `*/5 * * * *` cron trigger.
3. Verify queue consumers are attached to the API worker (Queues → `edaya-cron-jobs-*`).

`bun repo doctor` enforces a single heartbeat cron and `CRON_JOBS` queue binding in `wrangler.jsonc`.

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
