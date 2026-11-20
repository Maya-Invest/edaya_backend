ALTER TABLE students ALTER COLUMN identifier DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE guardians ALTER COLUMN identifier DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE teachers ALTER COLUMN identifier DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE staff_members DROP CONSTRAINT staff_visible_identity;
--> statement-breakpoint
ALTER TABLE staff_members ADD CONSTRAINT staff_visible_identity CHECK (account_kind = 'human' OR (account_kind = 'service' AND identifier IS NULL AND name IS NOT NULL AND short_name IS NOT NULL));
