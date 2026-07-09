ALTER TABLE "class_groups" ADD COLUMN IF NOT EXISTS "capacity" integer;
--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN IF NOT EXISTS "attendance_mode" text DEFAULT 'session' NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_groups" ADD COLUMN IF NOT EXISTS "homeroom_staff_id" text;
