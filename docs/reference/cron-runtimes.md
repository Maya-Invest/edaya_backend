# Cron runtimes

Scheduled jobs are defined in `@edaya/service` (`package/domain-service/src/capabilities/scheduling-jobs/`). Deployed workers run a **heartbeat** cron via Cloudflare `scheduled()` and execute work through a **Cloudflare Queue** consumer. Local debugging uses a one-shot CLI against the same PGlite database as `bun run repo dev`.

| Profile | Entry | Env source | Command |
|---------|-------|------------|---------|
| **local** | `apps/api/src/entries/cron-local.ts` | `apps/api/.env` | `bun cron:local` (root) |
| **worker** | `apps/api/src/entries/worker.ts` (`scheduled` + `queue`) | `wrangler.jsonc` + Wrangler secrets | `bun repo ops emergency-deploy production`, `bun repo ops emergency-deploy staging` |

## Environment variables

Uses the API `EnvSchema` (`apps/api/src/runtime/shared/env/schema.ts`).

| Variable | local (`bun cron:local`) | worker (`scheduled`) |
|----------|--------------------------|----------------------|
| `RUNTIME` | `local` | `worker` |
| `DATABASE_URL` | `pglite:.data/school` | Hyperdrive `connectionString` |
| `CRON_JOB_KEYS` | optional comma-separated filter (bypasses schedule table) | N/A |

Worker bindings (not env vars):

| Binding | Role |
|---------|------|
| `CRON_JOBS` | Queue producer (heartbeat) and consumer (`queue` handler) |

Local cron uses the same PGlite school database as `bun run repo dev`. Identity remains a separate service. Notification and storage adapters follow the existing runtime configuration.

## Local (one-shot against PGlite)

Requires a seeded local database (`bun run repo dev` at least once, or `bun repo ops seed` with API running).

```sh
bun --filter @edaya/api cron:local
```

Runs one heartbeat tick: commits school-bound occurrences and advances each due schedule atomically, then executes persisted work inline through the same claim/completion protocol as the Worker.

Optional filter (bypasses the schedule table and runs handlers directly):

```sh
CRON_JOB_KEYS=reconcilePendingDeliveries bun --filter @edaya/api cron:local
```

## Worker (Cloudflare)

A single heartbeat trigger is declared per deploy profile in `apps/api/wrangler.jsonc`:

| Cron expression | Role |
|-----------------|------|
| `*/5 * * * *` | Checks school work every five minutes and runs identity credential cleanup on the top-of-hour UTC tick |

Job schedules live in the `cron_job_schedules` table (seeded after school migrations via `seedCronJobSchedules`):

| `job_key` | `cron_expression` |
|-----------|-------------------|
| `expireAccountInvitations` | `0 2 * * *` |
| `processDueNotifications` | `0 6 * * *` |
| `reconcilePendingDeliveries` | `*/5 * * * *` |
| `advanceFamilyFeedbackCampaigns` | `*/5 * * * *` |
| `preparePrivateFileCleanup` | `*/15 * * * *` |

Queue names per deploy profile:

| Profile | Queue |
|---------|-------|
| staging | `edaya-cron-jobs-staging` |
| production | `edaya-cron-jobs-prod` |

Deploy with the API worker:

```sh
bun repo ops emergency-deploy staging    # staging
bun repo ops emergency-deploy production # production
```

## Architecture

```text
heartbeat (scheduled) or cron-local
  ├─ transaction + schedule lock
  │    ├─ select schools with work due for this job and create one occurrence per match
  │    ├─ command receipt + audit + execution/dispatch outbox rows
  │    └─ advance next_run_at; commit
  └─ dispatch committed work by { jobId }
       ├─ local: executeCronOccurrence
       └─ worker: CRON_JOBS → queue consumer → executeCronOccurrence
            ├─ claim lease; load stored school/job/version/current school
            └─ transaction: run existing handler + guarded work completion
```

A schedule advances even when no school has eligible work. Empty ticks still retry outstanding dispatches and drain previously committed work. Notification eligibility is checked per recipient, so an existing delivery for one profile does not suppress a newly eligible profile.

Migration `0015_cron_occurrences` adds immutable occurrence authority; `0014_command_journal` supplies receipts, audit and durable work. Occurrences are unique by school, schedule and the scheduled time that was due. A delayed heartbeat coalesces missed schedule ticks into one occurrence, with the winning heartbeat's persisted `asOf` window. Request tracing does not change occurrence identity. Competing heartbeats re-read the schedule under its transaction lock.

Only `{ jobId }` crosses the queue boundary. The consumer rejects legacy/full-authority payloads, acknowledges malformed/unknown/terminal references, and retries pending or transiently failed work with a 60-second queue delay. School/job/version authority comes from storage. Job effects and execution completion use one transaction; expiry or failure rolls both back. The scheduled handlers use transactional school/notification persistence; future handlers must preserve that contract or implement their own durable external-effect protocol.

Execution and transport each retain an eight-claim budget. Transport failures back off through the shared work adapter. After an accepted send, a later heartbeat can re-arm delivery if execution is still due and the last acceptance is at least 60 seconds old. It resends the same reference, preserves attempts and never resets a terminal budget. This also recovers a lost queue message. Worker queue retries are configured to 20 with a 60-second delay; these transport redeliveries do not bypass database claim/backoff rules. Missing `CRON_JOBS` fails closed in Worker mode. See [command execution](command-execution.md) for lease and failure semantics.

Structured log events: `cron.tick`, `cron.dispatch`, `cron.execute`.

Job catalog: `package/domain-service/src/capabilities/scheduling-jobs/cron-job-catalog.ts`. Add new jobs in service, register its handler in `cron-job-runner.ts` and its school eligibility query in `cron-due-schools.ts`, and insert a row into `cron_job_schedules`.

## Operations

### Cloudflare cleanup (one-time)

After deploying the merged API worker with heartbeat + queue:

1. In the Cloudflare dashboard, delete standalone Workers named `edaya-cron` / `edaya-cron-staging` if they still exist.
2. Confirm only `edaya-api-staging` / `edaya-api-prod` have a `*/5 * * * *` cron trigger.
3. Verify queue consumers are attached to the API worker (Queues → `edaya-cron-jobs-*`).

`bun repo check doctor` enforces a single heartbeat cron and `CRON_JOBS` queue binding in `wrangler.jsonc`.

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

Handlers remain in code; the table only controls **when** jobs run. Disabling a schedule prevents new occurrences; it does not revoke already committed work.

### Durable queue cutover and recovery

Apply migrations before enabling the new producer/consumer. Pause the heartbeat and drain the old queue with the old matched worker before switching to the reference-only protocol. Old queue messages do not have authoritative occurrence records and are deliberately rejected by the new consumer. Keep the old deployment/data/queue snapshot together if rollback is necessary; do not replay legacy authority payloads into the new consumer.

For diagnosis, inspect `command_outbox` by kind (`cron.dispatch` or `cron.execute`), resource ID, status, attempts and stable failure code. Read `cron_occurrences` to identify the school, handler and scheduled time. `dead` work is terminal and requires an operator to inspect the underlying cause and domain effects before any repair. There is no automatic budget reset or public generic replay endpoint. A dispatch failure after an uncertain queue acceptance may produce another message, but duplicate references cannot repeat committed execution effects. Provider-level notification duplicates after uncertain network delivery remain a separate limitation.

Queue acknowledgement and delay behavior follows [Cloudflare Queues batching and retries](https://developers.cloudflare.com/queues/configuration/batching-retries/). Local/native tests verify database and adapter behavior; they do not qualify a deployed Cloudflare queue.

See also: [cron-heartbeat-dispatcher-plan.md](../sprints/archive/cron-heartbeat-dispatcher-plan.md), [api-runtimes.md](./api-runtimes.md).
