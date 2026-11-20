-- Coordinated deployment: persist all relationship facts used by workflows.
-- Existing rows retain their previous domain defaults. Previously discarded
-- client values cannot be recovered from the database.
ALTER TABLE guardian_student_links
  ADD COLUMN is_billing_contact boolean NOT NULL DEFAULT false,
  ADD COLUMN legal_guardian boolean NOT NULL DEFAULT false,
  ADD COLUMN can_pickup boolean NOT NULL DEFAULT false,
  ADD COLUMN emergency_contact_priority integer,
  ADD COLUMN receives_academic_reports boolean NOT NULL DEFAULT true,
  ADD COLUMN receives_attendance_alerts boolean NOT NULL DEFAULT true,
  ADD COLUMN contact_restrictions text,
  ADD COLUMN notes text;
--> statement-breakpoint
ALTER TABLE student_health_profiles
  ALTER COLUMN allergies DROP NOT NULL,
  ALTER COLUMN medical_conditions DROP NOT NULL,
  ADD COLUMN emergency_protocols text,
  ADD COLUMN updated_at timestamp;
--> statement-breakpoint
UPDATE student_health_profiles SET updated_at = created_at;
--> statement-breakpoint
ALTER TABLE student_health_profiles ALTER COLUMN updated_at SET NOT NULL;
