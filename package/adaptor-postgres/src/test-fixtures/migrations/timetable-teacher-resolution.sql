ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "timetable_allow_unassigned_teacher_placements" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN IF NOT EXISTS "timetable_use_homeroom_teacher_fallback" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD COLUMN IF NOT EXISTS "timetable_teacher_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
