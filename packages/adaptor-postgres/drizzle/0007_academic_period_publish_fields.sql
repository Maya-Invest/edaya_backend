ALTER TABLE "academic_periods" ADD COLUMN "type" text;
--> statement-breakpoint
ALTER TABLE "academic_periods" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
UPDATE "academic_periods" SET "type" = 'trimester', "is_published" = true WHERE "id" IN ('2025-t1', '2025-t2', '2025-t3');
