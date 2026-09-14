import type { NotifyRuntime } from "../runtime";
import { sendJob } from "./send-job";

/** Poll durable school notification and invitation intent. Auth emails retain awaited delivery. */
export async function drainPendingSchoolNotifications(runtime: NotifyRuntime, limit = 20): Promise<number> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100)
    throw new Error("Invalid notification batch limit");
  await runtime.sql.execute(`UPDATE notify.jobs SET status = 'dead', lease_id = NULL, lease_expires_at = NULL,
    failure_reason = CASE WHEN payload_version <> 1 THEN 'NOTIFY_VERSION_UNSUPPORTED' ELSE 'NOTIFY_ATTEMPTS_EXHAUSTED' END,
    updated_at = clock_timestamp()
    WHERE job_kind IN ('school', 'invitation') AND status IN ('pending', 'failed', 'sending')
      AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp())
      AND (payload_version <> 1 OR attempts >= 5)`);
  const jobs = await runtime.sql.query<{ idempotency_key: string }>(`
    SELECT idempotency_key FROM notify.jobs
    WHERE job_kind IN ('school', 'invitation') AND status IN ('pending', 'failed', 'sending')
      AND (lease_expires_at IS NULL OR lease_expires_at < NOW())
      AND (next_attempt_at IS NULL OR next_attempt_at <= NOW()) AND attempts < 5 AND payload_version = 1
    ORDER BY created_at, idempotency_key LIMIT $1`, [limit]);
  for (const job of jobs) await sendJob(job.idempotency_key, runtime);
  return jobs.length;
}
