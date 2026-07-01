ALTER TABLE "assessments" RENAME COLUMN "met_at" TO "completed_at";
--> statement-breakpoint
ALTER TABLE "assessments" DROP COLUMN IF EXISTS "date";
