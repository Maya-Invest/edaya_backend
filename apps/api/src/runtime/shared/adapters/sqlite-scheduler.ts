import type {
  CronJobKey,
  CronJobSchedule,
  ScheduleDefinition,
  SchedulerMessage,
  SchedulerPort,
  SchedulerWork,
} from "@edaya/service";
import { schedulerMaxAttempts as maxHandoffs, schedulerLeaseMs } from "@edaya/service";
/** Common subset of a D1 binding and the persisted local SQLite adapter. */
export interface SchedulerDatabase {
  prepare: (query: string) => {
    bind: (...values: (string | number | null)[]) => {
      all: <T>() => Promise<{ results: T[]; meta?: { rows_read?: number; rows_written?: number } }>;
    };
  };
}

export class SqliteScheduler implements SchedulerPort {
  readonly usage = { rowsRead: 0, rowsWritten: 0 };
  constructor(private readonly db: SchedulerDatabase) {}
  async query<T>(statement: string, ...values: (number | string | null)[]): Promise<T[]> {
    const result = await this.db
      .prepare(statement)
      .bind(...values)
      .all<T>();
    this.usage.rowsRead += result.meta?.rows_read ?? 0;
    this.usage.rowsWritten += result.meta?.rows_written ?? 0;
    return result.results;
  }

  private async workRows(statement: string, ...values: (number | string | null)[]) {
    const rows = await this.query<{
      ref: string;
      kind: string;
      revision: number;
      cron_expression: string | null;
      due_at: number | null;
      available_at: number | null;
      lease: string | null;
      attempts: number;
      dead: number;
      projection_pending: number;
      replay_requested: number;
      failure: string | null;
    }>(statement, ...values);
    return rows.map((row): SchedulerWork => ({
      ref: row.ref,
      kind: row.kind,
      revision: row.revision,
      cronExpression: row.cron_expression,
      dueAt: row.due_at,
      availableAt: row.available_at,
      lease: row.lease,
      attempts: row.attempts,
      projectionPending: !!row.projection_pending,
      replayRequested: !!row.replay_requested,
      exhausted: !!row.dead,
      failure: row.failure,
    }));
  }

  async project(ref: string, kind: string, revision: number, due: number | null) {
    // A later revision with the same deadline keeps its lease and retry budget.
    const preserveDispatch
      = "excluded.due_at IS scheduler_work.due_at AND scheduler_work.projection_pending=0 AND (scheduler_work.dead=0 OR scheduler_work.due_at IS NOT NULL)";
    await this.query(
      `INSERT INTO scheduler_work(ref,kind,revision,due_at,available_at) VALUES(?,?,?,?,?)
      ON CONFLICT(ref) DO UPDATE SET revision=excluded.revision,kind=excluded.kind, due_at=excluded.due_at,replay_requested=0,projection_pending=0,
      available_at=CASE WHEN ${preserveDispatch} THEN scheduler_work.available_at ELSE excluded.due_at END,
      attempts=CASE WHEN ${preserveDispatch} THEN scheduler_work.attempts ELSE 0 END,
      dead=CASE WHEN ${preserveDispatch} THEN scheduler_work.dead ELSE 0 END,
      failure=CASE WHEN ${preserveDispatch} THEN scheduler_work.failure ELSE NULL END,
      lease=CASE WHEN ${preserveDispatch} THEN scheduler_work.lease ELSE NULL END,
      executing=CASE WHEN ${preserveDispatch} THEN scheduler_work.executing ELSE 0 END
      WHERE excluded.revision>scheduler_work.revision OR (excluded.revision=scheduler_work.revision AND scheduler_work.projection_pending=1)`,
      ref,
      kind,
      revision,
      due,
      due,
    );
  }

  async deferProjection(ref: string, kind: string, revision: number, now: number) {
    await this.query(
      `INSERT INTO scheduler_work(ref,kind,revision,available_at,projection_pending,failure)
      VALUES(?,?,?,?,1,'SCHEDULER_PUBLICATION_FAILED') ON CONFLICT(ref) DO UPDATE SET revision=excluded.revision,kind=excluded.kind,
      available_at=excluded.available_at,replay_requested=0,projection_pending=1,failure=excluded.failure,due_at=NULL,attempts=0,dead=0,lease=NULL,executing=0
      WHERE excluded.revision>scheduler_work.revision`,
      ref,
      kind,
      revision,
      now,
    );
  }

  async exhausted(ref: string, kind: string, revision: number, attempts: number, code: string) {
    const updated = await this.query(
      `INSERT INTO scheduler_work(ref,kind,revision,attempts,dead,failure)
      VALUES(?,?,?,?,1,?) ON CONFLICT(ref) DO UPDATE SET
      revision=excluded.revision,kind=excluded.kind,projection_pending=0,replay_requested=0,dead=1,failure=excluded.failure,attempts=excluded.attempts,
      available_at=NULL,due_at=NULL,lease=NULL,executing=0
      WHERE excluded.revision>scheduler_work.revision OR
        (excluded.revision=scheduler_work.revision AND scheduler_work.dead=0) RETURNING ref`,
      ref,
      kind,
      revision,
      attempts,
      code,
    );
    return updated.length > 0;
  }

  async wakePublisher() {
    await this.query(`INSERT INTO scheduler_work(ref,kind,revision,due_at,available_at)
      VALUES('school-publish','school-publish',1,0,0) ON CONFLICT(ref) DO UPDATE SET
      revision=revision+1,due_at=0,available_at=0,lease=NULL,executing=0 WHERE dead=0 AND (available_at IS NULL OR executing=1)`);
  }

  async get(ref: string) {
    return (await this.workRows("SELECT * FROM scheduler_work WHERE ref=?", ref))[0];
  }

  async dueBusiness(now: number) {
    return this.query<{ ref: string; kind: string }>(
      `SELECT ref,kind FROM scheduler_work WHERE dead=0 AND available_at<=?
        AND ref NOT IN ('school-recovery','identity-cleanup','school-publish')`,
      now,
    );
  }

  async advanceShadowRecovery(expected: SchedulerWork, next: number | null) {
    await this.query(
      "UPDATE scheduler_work SET available_at=?,due_at=? WHERE ref='school-recovery' AND available_at=? AND revision=?",
      next,
      next,
      expected.availableAt,
      expected.revision,
    );
  }

  async schedules(): Promise<CronJobSchedule[]> {
    const rows = await this.query<{
      id: string;
      kind: CronJobKey;
      expression: string;
      enabled: number;
      next_run_at: number;
    }>("SELECT * FROM schedules");
    return rows.map(row => ({
      id: row.id,
      jobKey: row.kind,
      cronExpression: row.expression,
      enabled: !!row.enabled,
      nextRunAt: new Date(row.next_run_at),
      lastDispatchedAt: null,
    }));
  }

  async importDefinitions(rows: ScheduleDefinition[]) {
    if (!rows.length)
      return;
    const placeholders = rows.map(() => "(?,?,?,?,?,?)").join(",");
    await this.query(
      `INSERT INTO schedules(id,kind,expression,enabled,next_run_at,revision) VALUES ${placeholders}
      ON CONFLICT(kind) DO UPDATE SET id=excluded.id,expression=excluded.expression,enabled=excluded.enabled,
      next_run_at=excluded.next_run_at,revision=excluded.revision WHERE excluded.revision>schedules.revision`,
      ...rows.flatMap(row => [
        row.id,
        row.jobKey,
        row.cronExpression,
        Number(row.enabled),
        row.nextRunAt.getTime(),
        row.revision,
      ]),
    );
  }

  async claim(now: number) {
    // One statement selects and fences the same rows across concurrent ticks.
    return this.workRows(
      `UPDATE scheduler_work SET lease=lower(hex(randomblob(4))) || '-' ||
      lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' || lower(hex(randomblob(2))) || '-' ||
      lower(hex(randomblob(6))), executing=0, attempts=min(attempts+1,?), available_at=?,
      dead=CASE WHEN attempts>=? THEN 1 ELSE 0 END,
      failure=CASE WHEN attempts>=? THEN 'SCHEDULER_RETRIES_EXHAUSTED' ELSE failure END
      WHERE ref IN (SELECT ref FROM scheduler_work WHERE dead=0 AND available_at<=?
        ORDER BY available_at,ref LIMIT 100) RETURNING *`,
      maxHandoffs,
      now + schedulerLeaseMs,
      maxHandoffs,
      maxHandoffs,
      now,
    );
  }

  async begin(message: SchedulerMessage, now: number) {
    return (
      await this.workRows(
        `UPDATE scheduler_work SET executing=1,available_at=?
      WHERE ref=? AND lease=? AND executing=0 AND dead=0 AND available_at>? RETURNING *`,
        now + schedulerLeaseMs,
        message.ref,
        message.lease,
        now,
      )
    )[0];
  }

  async finish(work: SchedulerWork, next: number | null) {
    const updated = await this.query(
      `UPDATE scheduler_work SET due_at=?,available_at=?,lease=NULL,executing=0,
      failure=NULL,replay_requested=0,attempts=0 WHERE ref=? AND lease=? AND revision=? RETURNING ref`,
      next,
      next,
      work.ref,
      work.lease,
      work.revision,
    );
    return updated.length > 0;
  }

  async fail(work: SchedulerWork, now: number, code: string) {
    await this.query(
      `UPDATE scheduler_work SET lease=NULL,executing=0,failure=?,available_at=?,
      dead=CASE WHEN attempts>=? THEN 1 ELSE 0 END WHERE ref=? AND lease=?`,
      code,
      now + Math.min(900, 5 * 2 ** (work.attempts - 1)) * 1000,
      maxHandoffs,
      work.ref,
      work.lease,
    );
  }
}
