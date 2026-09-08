ALTER TABLE "period_definitions" ADD COLUMN "day_of_week" text;
--> statement-breakpoint
ALTER TABLE "period_definitions" ADD COLUMN "is_teaching_slot" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
INSERT INTO "period_definitions" (
  "id",
  "school_id",
  "academic_year_id",
  "label",
  "day_of_week",
  "order_val",
  "start_time",
  "end_time",
  "is_break",
  "is_teaching_slot",
  "created_at"
)
SELECT
  pd."id" || '__' || weekdays."day_of_week",
  pd."school_id",
  pd."academic_year_id",
  pd."label",
  weekdays."day_of_week",
  pd."order_val",
  pd."start_time",
  pd."end_time",
  pd."is_break",
  true,
  pd."created_at"
FROM "period_definitions" pd
CROSS JOIN (
  VALUES ('tuesday'), ('wednesday'), ('thursday'), ('friday')
) AS weekdays("day_of_week")
WHERE pd."day_of_week" IS NULL;
--> statement-breakpoint
UPDATE "period_definitions" SET "day_of_week" = 'monday' WHERE "day_of_week" IS NULL;
--> statement-breakpoint
ALTER TABLE "period_definitions" ALTER COLUMN "day_of_week" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "grade_level_subjects" ADD COLUMN "periods_per_week" integer;
--> statement-breakpoint
ALTER TABLE "class_subjects" ADD COLUMN "periods_per_week" integer;
--> statement-breakpoint
ALTER TABLE "lesson_sessions" ALTER COLUMN "schedule_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "lesson_sessions" ADD COLUMN "timetable_generated" text;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "timetable_enforce_workload_fulfillment" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "timetable_exclude_break_slots" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "timetable_min_period_gap_same_subject" integer DEFAULT 2 NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "timetable_preferred_period_definition_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
