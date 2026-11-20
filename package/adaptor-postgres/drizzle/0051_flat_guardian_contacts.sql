DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM guardians) THEN
    RAISE EXCEPTION 'Flat guardian contacts require an empty guardian table. Back up and reset the local database before applying this fresh-database cutover.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE guardians
  ADD COLUMN alternative_phone text,
  ADD COLUMN email_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN sms_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN push_notifications_enabled boolean NOT NULL DEFAULT true,
  DROP COLUMN contact_methods,
  DROP COLUMN notification_email,
  DROP COLUMN notification_phone;
