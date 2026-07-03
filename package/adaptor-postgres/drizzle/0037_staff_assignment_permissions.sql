ALTER TABLE "staff_assignments" ADD COLUMN IF NOT EXISTS "academic_year_id" text;
--> statement-breakpoint
ALTER TABLE "staff_assignments" ADD COLUMN IF NOT EXISTS "permissions" jsonb DEFAULT '[]'::jsonb NOT NULL;
