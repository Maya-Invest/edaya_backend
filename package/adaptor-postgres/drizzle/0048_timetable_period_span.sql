ALTER TABLE "schools" ADD COLUMN "timetable_min_period_span" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" ADD COLUMN "timetable_max_period_span" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "grade_level_subjects" ADD COLUMN "min_period_span" integer;
--> statement-breakpoint
ALTER TABLE "grade_level_subjects" ADD COLUMN "max_period_span" integer;
--> statement-breakpoint
ALTER TABLE "class_subjects" ADD COLUMN "min_period_span" integer;
--> statement-breakpoint
ALTER TABLE "class_subjects" ADD COLUMN "max_period_span" integer;
