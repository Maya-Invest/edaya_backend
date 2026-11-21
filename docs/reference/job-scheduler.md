# Job scheduling

By default the Worker receives a heartbeat every five minutes. In active mode, it claims due work in the scheduler database and sends opaque versioned references to `CRON_JOBS`. An idle tick can finish before either Postgres handle opens. School recovery and Identity credential deletion have independently configurable deadlines that default to 02:00 UTC daily. A new scheduler database requests its first School backfill immediately.

## Persistence boundary

The service defines `SchedulerPort` for schedule definitions, deadlines, revision checks and expiring execution leases, and `SchedulerAdminPort` for inspection and recovery. The composition root supplies a D1 adapter to the Worker and a persistent SQLite adapter to Bun. Queue transport is injected separately. The School Postgres adapter implements `SchoolSchedulingPort` and records dirty references in the transaction that modifies business data. A successful projection marks only that revision published. A later delete, reschedule or cancellation wins over an older post-commit handoff.

An alternative scheduler store must implement atomic claims and conditional completion, reject older revisions, retain cancellation tombstones, persist independent maintenance deadlines and support an indexed query for due work. Run the scheduling contract tests against the replacement and backfill it from School before changing ownership. The School and Identity databases, notification sender and authentication provider sit outside this storage boundary.

## Operation

Run commands from the backend root. Each command requires a target of `local`, `staging` or `production`.

```sh
bun repo ops scheduler inspect local
bun repo ops scheduler inspect local <reference>
bun repo ops scheduler replay local <reference>
bun repo ops scheduler reconcile local
```

Inspect lists up to 100 outstanding records, with exhausted work first. Replay arms one failed reference for its next eligible tick. The consumer rereads the business record and uses its existing receipt and notification recipient history. Completed work yields an empty replay result. Interrupted, uncertain or rejected SMS remains protected. Reconcile requests a School rebuild on the next active or shadow tick. A response containing a reference confirms that the request was recorded. Local state survives process restarts and is scoped to the local API and database configuration. `bun run cron:local` from `apps/api` runs one tick. Set `CRON_JOB_KEYS` to run selected School jobs explicitly.

## Configure scheduler timing

| Setting | Active-mode default | Where to change it |
| --- | --- | --- |
| Heartbeat | Every five minutes | Set the Worker environment’s `triggers.crons` in `apps/api/wrangler.jsonc`. For Bun, set `LOCAL_HEARTBEAT_MINUTES` in `apps/api/config.local.jsonc` and restart. |
| School recovery | Daily at 02:00 UTC | `bun repo ops scheduler configure <target> school-recovery '<cron>'` |
| Identity cleanup | Daily at 02:00 UTC | `bun repo ops scheduler configure <target> identity-cleanup '<cron>'` |

The two maintenance schedules are stored in the scheduler database. Use a quoted, five-field UTC cron expression. For example, these commands set School recovery to every six hours, set Identity cleanup to 03:30 UTC daily, and show both settings.

```sh
bun repo ops scheduler configure local school-recovery '0 */6 * * *'
bun repo ops scheduler configure local identity-cleanup '30 3 * * *'
bun repo ops scheduler schedules local
```

A missed maintenance run executes once on the next available tick. The five recurring School jobs use their existing schedule definitions and eligibility rules. Event-driven work becomes dispatchable after commit when its deadline is due. An upgrade removes old event dispatch windows and preserves pending deadlines, leases and retries. A maintenance schedule previously set to `off` can be resumed by assigning a cron expression.

During rollout, legacy and shadow dispatch use the legacy Identity purge interval, hourly by default. `LEGACY_IDENTITY_CLEANUP_CRON` accepts a UTC cron expression aligned with the Worker heartbeat.

## Changing dispatch ownership

1. Deploy the reader that accepts both `{jobId}` and versioned scheduler messages with `SCHEDULER_MODE=legacy`. The default Worker mode is legacy. Apply the School and scheduler migrations to the matching environment.
2. Set `SCHEDULER_MODE=shadow` in staging, request a reconcile, and let legacy dispatch for a full daily cycle. Inspect the `scheduler.shadow` logs for overdue publications and differing decisions. Legacy reconciliation includes settled deliveries so check disparities against the actual notification receipts. In shadow, only the existing scheduler sends jobs.
3. Before switching, reconcile and finish outstanding publications, recover expired leases, and inspect exhausted references. Pause the scheduler and jobs during the owner change, wait for in-flight handlers to finish, then set the new mode and resume. Existing legacy messages remain readable. Domain receipts and the unique School/schedule/slot key protect effects across a handover.
4. To roll back, reconcile while active, let ready work finish, then use the same pause and handover procedure to restore legacy dispatch. Its first tick rediscovers due School work and pending business outbox rows in Postgres. Re-run shadow and reconcile before reactivating the scheduler.

## Measuring the change

Keep separate quiet and workload windows. In a quiet 24-hour window after backfill, count 288 `scheduler.tick` events. Check that `scheduler.start` contains only `school-recovery` and `identity-cleanup` at the daily maintenance window. Correlate scheduled events with School and Identity connection activity, accounting for unrelated API requests. Record Neon CU-hours and endpoint awake minutes for each database and D1 rows read and written for the same UTC boundaries. Heartbeat logs expose claim-query row counts. D1 database analytics also includes request publications and consumption.

For the workload window, record lateness from `scheduler.start.lateMs`, failed handoffs, exhausted references, and Postgres occurrence and receipt counts. Exercise a reschedule, cancellation, batch continuation, expired lease and lost publication. The next School recovery must restore the missing deadline. Compare jobs against their configured UTC cron slots and check provider receipts before replaying an external send.
