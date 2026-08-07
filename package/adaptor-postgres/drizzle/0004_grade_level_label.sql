ALTER TABLE "grade_levels" ADD COLUMN "label" text;
--> statement-breakpoint
UPDATE "grade_levels" SET "label" = "name" WHERE "label" IS NULL;
--> statement-breakpoint
ALTER TABLE "grade_levels" ALTER COLUMN "label" SET NOT NULL;
