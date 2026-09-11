import type { NotifyRuntime } from "../runtime";
import { sendJob } from "./send-job";

/** Poll durable school notification intent. Auth emails retain awaited delivery. */
export async function drainPendingSchoolNotifications(runtime: NotifyRuntime, limit = 20): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid notification batch limit");
  const jobs = await runtime.sql.query<{ idempotency_key: string }>(`
    SELECT idempotency_key FROM notify.jobs
    WHERE job_kind = 'school' AND status IN ('pending', 'failed', 'sending')
      AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
      AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()) AND attempts < 5
    ORDER BY created_at, idempotency_key LIMIT $1`, [limit]);
  for (const job of jobs) await sendJob(job.idempotency_key, runtime);
  return jobs.length;
}
