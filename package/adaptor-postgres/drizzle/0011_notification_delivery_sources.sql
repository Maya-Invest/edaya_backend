-- Offline cutover only. Delivery IDs are opaque provider correlation keys: never
-- rename them or rewrite provider jobs. Source + login + profile identifies retries.
ALTER TABLE message_deliveries ADD COLUMN source_key text;
--> statement-breakpoint
UPDATE message_deliveries SET source_key = announcement_id WHERE announcement_id IS NOT NULL;
--> statement-breakpoint
DO $$
DECLARE invalid_id text;
BEGIN
  SELECT id INTO invalid_id FROM message_deliveries
  WHERE announcement_id IS NULL AND left(id, 9) = 'delivery:'
    AND (event_key IS NULL OR right(id, length(subject_id) + 1) <> ':' || subject_id
      OR left(substring(id FROM 10), length(event_key) + 1) <> event_key || ':'
      OR length(id) <= 10 + length(event_key) + length(subject_id))
  LIMIT 1;
  IF invalid_id IS NOT NULL THEN
    RAISE EXCEPTION 'Cannot determine notification source for delivery %. Resolve the record before cutover.', invalid_id;
  END IF;
END $$;
--> statement-breakpoint
UPDATE message_deliveries
SET source_key = substring(id FROM 10 FOR length(id) - 10 - length(subject_id))
WHERE announcement_id IS NULL AND left(id, 9) = 'delivery:';
--> statement-breakpoint
DO $$
DECLARE invalid_id text;
BEGIN
  SELECT id INTO invalid_id FROM message_deliveries
  WHERE source_key IS NOT NULL AND
    (length(btrim(source_key)) = 0 OR recipient_kind IS NULL
      OR recipient_kind NOT IN ('staff', 'teacher', 'guardian', 'student')
      OR recipient_id IS NULL OR length(btrim(recipient_id)) = 0)
  LIMIT 1;
  IF invalid_id IS NOT NULL THEN
    RAISE EXCEPTION 'Delivery % has an ambiguous recipient profile. Resolve the record before cutover; never infer a profile from the login.', invalid_id;
  END IF;
END $$;
--> statement-breakpoint
-- Collisions abort deployment instead of silently choosing a recipient or status.
CREATE UNIQUE INDEX message_deliveries_source_recipient_uidx
  ON message_deliveries (school_id, source_key, subject_id, recipient_kind, recipient_id);
--> statement-breakpoint
ALTER TABLE message_deliveries ADD CONSTRAINT message_deliveries_source_recipient_check
  CHECK (source_key IS NULL OR (length(btrim(source_key)) > 0
    AND recipient_kind IS NOT NULL AND recipient_kind IN ('staff', 'teacher', 'guardian', 'student')
    AND recipient_id IS NOT NULL AND length(btrim(recipient_id)) > 0));
