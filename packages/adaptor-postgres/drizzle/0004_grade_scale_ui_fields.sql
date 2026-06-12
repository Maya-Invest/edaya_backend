ALTER TABLE "grade_scales" ADD COLUMN "decimal_places" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "grade_scales" ADD COLUMN "description" text;
