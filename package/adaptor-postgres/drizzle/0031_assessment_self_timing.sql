ALTER TABLE "assessments" ADD COLUMN "starts_at" timestamp;
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "ends_at" timestamp;
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "description" text;
--> statement-breakpoint
ALTER TABLE "assessments" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
UPDATE "assessments"
SET
  "starts_at" = ("date"::timestamp + interval '9 hours'),
  "ends_at" = ("date"::timestamp + interval '10 hours')
WHERE "kind" <> 'homework'
  AND "date" IS NOT NULL
  AND "starts_at" IS NULL;
--> statement-breakpoint
UPDATE "assessments"
SET "due_at" = NULL
WHERE "kind" <> 'homework'
  AND "due_at" IS NOT NULL
  AND "date" IS NOT NULL
  AND "due_at" = "date";
