ALTER TABLE "message_deliveries" ADD COLUMN "school_id" text;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD COLUMN "body" text;--> statement-breakpoint
ALTER TABLE "message_deliveries" ADD COLUMN "event_key" text;--> statement-breakpoint
UPDATE "message_deliveries" md
SET
  "school_id" = a."school_id",
  "title" = a."title",
  "body" = a."content"
FROM "announcements" a
WHERE md."announcement_id" = a."id";--> statement-breakpoint
ALTER TABLE "message_deliveries" ALTER COLUMN "school_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_deliveries" ALTER COLUMN "title" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_deliveries" ALTER COLUMN "body" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_deliveries" ALTER COLUMN "announcement_id" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "message_deliveries_school_id_idx" ON "message_deliveries" ("school_id");--> statement-breakpoint
ALTER TABLE "announcements" DROP COLUMN "premium_notification";
