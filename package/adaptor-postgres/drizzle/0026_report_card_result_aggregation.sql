ALTER TABLE "report_card_results" ADD COLUMN "aggregation" jsonb;
--> statement-breakpoint
ALTER TABLE "report_card_definition_sections" DROP COLUMN "aggregation";
