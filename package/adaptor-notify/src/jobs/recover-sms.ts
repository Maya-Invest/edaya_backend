import type { NotifySql } from "../store/types";

/** Claim the expired job row before recovering its SMS markers; serialize with new leases. */
export async function recoverInterruptedSms(sql: NotifySql, jobId?: string): Promise<void> {
  await sql.execute(`WITH expired AS (
    SELECT job.idempotency_key FROM notify.jobs job
    WHERE ($1::text IS NULL OR job.idempotency_key = $1)
      AND (lease_expires_at IS NULL OR lease_expires_at <= clock_timestamp())
      AND EXISTS (SELECT 1 FROM notify.job_recipients pending
        WHERE pending.idempotency_key = job.idempotency_key AND pending.channel = 'sms' AND pending.status = 'sending')
    FOR UPDATE
  ) UPDATE notify.job_recipients recipient
    SET status = 'uncertain', failure_reason = 'SMS_DELIVERY_UNCERTAIN'
    FROM expired WHERE recipient.idempotency_key = expired.idempotency_key
      AND recipient.channel = 'sms' AND recipient.status = 'sending'`, [jobId ?? null]);
}
