ALTER TABLE "report_card_definitions" ADD COLUMN "grade_scale_id" text DEFAULT 'gs-20' NOT NULL;
--> statement-breakpoint
ALTER TABLE "report_card_definitions" ADD COLUMN "status" text DEFAULT 'draft' NOT NULL;
