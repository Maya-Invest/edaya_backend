ALTER TABLE "grade_level_subjects" ADD COLUMN "is_optional" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_subjects" ADD COLUMN "is_offered" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "report_card_definition_sections" ADD COLUMN "aggregation" jsonb;
