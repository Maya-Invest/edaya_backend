ALTER TABLE "message_deliveries" ADD COLUMN "subject_id" text;--> statement-breakpoint
UPDATE "message_deliveries" md
SET "subject_id" = sm."subject_id"
FROM "staff_members" sm
WHERE md."recipient_kind" = 'staff'
  AND md."recipient_id" = sm."id"
  AND sm."subject_id" IS NOT NULL;--> statement-breakpoint
UPDATE "message_deliveries" md
SET "subject_id" = g."subject_id"
FROM "guardians" g
WHERE md."recipient_kind" = 'guardian'
  AND md."recipient_id" = g."id"
  AND g."subject_id" IS NOT NULL;--> statement-breakpoint
UPDATE "message_deliveries" md
SET "subject_id" = s."subject_id"
FROM "students" s
WHERE md."recipient_kind" = 'student'
  AND md."recipient_id" = s."id"
  AND s."subject_id" IS NOT NULL;--> statement-breakpoint
DELETE FROM "message_deliveries" WHERE "subject_id" IS NULL;--> statement-breakpoint
ALTER TABLE "message_deliveries" ALTER COLUMN "subject_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_deliveries" DROP COLUMN "channel";--> statement-breakpoint
CREATE INDEX "message_deliveries_subject_id_idx" ON "message_deliveries" ("subject_id");
