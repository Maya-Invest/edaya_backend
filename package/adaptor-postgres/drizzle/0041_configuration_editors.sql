ALTER TABLE "schools" ADD COLUMN "short_name" text;
--> statement-breakpoint
UPDATE "schools" SET "short_name" = CASE
 WHEN position('—' in name) > 0 AND btrim(regexp_replace(name, '^.*—', '')) <> '' THEN btrim(regexp_replace(name, '^.*—', ''))
 WHEN position(' - ' in name) > 0 AND btrim(regexp_replace(name, '^.* - ', '')) <> '' THEN btrim(regexp_replace(name, '^.* - ', ''))
 ELSE (regexp_split_to_array(btrim(name), '\s+'))[1] END;
--> statement-breakpoint
ALTER TABLE "schools" ALTER COLUMN "short_name" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "schools" DROP COLUMN "type";
--> statement-breakpoint
ALTER TABLE "report_card_definitions" ADD COLUMN "revision" integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE "report_card_definition_sections" ALTER COLUMN "weight" TYPE real USING "weight"::real;
