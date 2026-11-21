import { computeNextRunAt, maintenanceJobKeys, validateJobCron } from "@edaya/service";
import type { MaintenanceSchedule, SchedulerAdminPort, SchedulerInspection } from "@edaya/service";
import { isSchedulerRef } from "../../../cron/scheduler/dispatch";

function schedulerOperationSql(operation: string, ref?: string) {
  if (
    !["inspect", "replay", "reconcile"].includes(operation)
    || (operation === "reconcile" && ref)
    || (ref !== undefined && !isSchedulerRef(ref))
    || (operation === "replay" && !ref)
  ) {
    throw new Error("Expected scheduler inspect|replay local|staging|production and an opaque work reference");
  }
  // A reference has already been validated against the same UUID syntax as the consumer.
  if (operation === "reconcile")
    return `UPDATE scheduler_work SET due_at=0,available_at=0,dead=0,attempts=0,failure=NULL WHERE ref='school-recovery' AND lease IS NULL RETURNING ref`;
  return operation === "replay"
    ? `UPDATE scheduler_work SET available_at=0,lease=NULL,executing=0,dead=0,attempts=0,replay_requested=1,failure=NULL
       WHERE ref='${ref}' AND (dead=1 OR (failure IS NOT NULL AND (due_at IS NOT NULL OR projection_pending=1))) AND (lease IS NULL OR dead=1) RETURNING ref`
    : `SELECT ref,kind,revision,due_at AS dueAt,available_at AS availableAt,attempts,failure,
       CASE WHEN dead=1 THEN 'exhausted' WHEN executing=1 THEN 'executing' WHEN lease IS NOT NULL THEN 'leased'
         WHEN available_at IS NULL THEN 'idle' ELSE 'waiting' END AS state FROM scheduler_work
       WHERE ${ref ? `ref='${ref}'` : "available_at IS NOT NULL OR dead=1"} ORDER BY dead DESC,available_at,ref LIMIT 100`;
}

export function sqliteSchedulerAdmin(execute: <T>(statement: string) => Promise<T[]>): SchedulerAdminPort {
  return {
    settings: () => execute<MaintenanceSchedule>(
      `SELECT ref AS kind,coalesce(cron_expression,'off') AS schedule
       FROM scheduler_work WHERE ref IN ('school-recovery','identity-cleanup') ORDER BY ref`,
    ),
    configureMaintenance: async (kind, value, now) => {
      if (!maintenanceJobKeys.includes(kind) || !Number.isSafeInteger(now))
        throw new Error("Invalid maintenance setting");
      const expression = validateJobCron(value);
      const next = computeNextRunAt(expression, new Date(now)).getTime();
      // Fence queued deliveries, keep overdue catch-up and let an in-flight run finish.
      const due = `CASE WHEN executing=1 OR due_at<=${now} THEN due_at ELSE ${next} END`;
      await execute(`UPDATE scheduler_work SET cron_expression='${expression}',revision=revision+1,
        due_at=${due},available_at=CASE WHEN dead=1 THEN NULL WHEN executing=1 THEN available_at ELSE ${due} END,
        lease=CASE WHEN executing=1 THEN lease ELSE NULL END,
        attempts=CASE WHEN dead=1 OR executing=1 THEN attempts ELSE 0 END,
        failure=CASE WHEN dead=1 OR executing=1 THEN failure ELSE NULL END
        WHERE ref='${kind}' AND cron_expression IS NOT '${expression}'`);
    },
    inspect: ref => execute<SchedulerInspection>(schedulerOperationSql("inspect", ref)),
    replay: ref => execute<{ ref: string }>(schedulerOperationSql("replay", ref)),
    reconcile: () => execute<{ ref: string }>(schedulerOperationSql("reconcile")),
  };
}
