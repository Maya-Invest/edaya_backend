ALTER TABLE report_card_definitions ADD COLUMN pass_threshold numeric;
--> statement-breakpoint
ALTER TABLE report_card_results ALTER COLUMN pass_threshold TYPE numeric;
