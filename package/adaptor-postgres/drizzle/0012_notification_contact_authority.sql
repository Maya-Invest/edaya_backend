-- School contacts are read from the exact delivery profile at send time.
-- Keep only command-owned authentication and invitation destinations. Existing
-- jobs, channel receipts and device registrations retain their original IDs.
DO $$
BEGIN
  IF to_regclass('notify.recipients') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM notify.recipients r
    JOIN notify.job_recipients jr ON jr.subject_id = r.subject_id
    JOIN notify.jobs j ON j.idempotency_key = jr.idempotency_key
    WHERE j.job_kind <> 'school' AND (
      (j.job_kind IN ('auth_otp', 'auth_verification') AND r.tenant = 'platform'
        AND r.subject_id = 'auth:' || r.email AND r.recipient_id = r.email)
      OR (j.job_kind = 'invitation' AND r.subject_id = 'invite:' || j.idempotency_key
        AND r.recipient_id = j.idempotency_key AND r.tenant = j.tenant)
    ) IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'Ambiguous command notification destination; reconcile before cutover';
  END IF;

  DELETE FROM notify.recipients r WHERE (
    (r.tenant = 'platform' AND r.subject_id = 'auth:' || r.email AND r.recipient_id = r.email)
    OR EXISTS (
      SELECT 1 FROM notify.jobs j WHERE j.job_kind = 'invitation'
        AND r.subject_id = 'invite:' || j.idempotency_key
        AND r.recipient_id = j.idempotency_key AND r.tenant = j.tenant
    )
  ) IS NOT TRUE;

  ALTER TABLE notify.recipients ADD CONSTRAINT command_notification_destination CHECK (
    ((tenant = 'platform' AND subject_id = 'auth:' || email AND recipient_id = email)
    OR subject_id = 'invite:' || recipient_id) IS TRUE
  );
END $$;
