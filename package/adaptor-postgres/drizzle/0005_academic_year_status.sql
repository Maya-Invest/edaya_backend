ALTER TABLE "academic_years" ADD COLUMN "status" text;
--> statement-breakpoint
UPDATE "academic_years" SET "status" = CASE WHEN "is_active" = true THEN 'published' ELSE 'archived' END;
--> statement-breakpoint
ALTER TABLE "academic_years" ALTER COLUMN "status" SET NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "academic_years_school_active_idx";
--> statement-breakpoint
ALTER TABLE "academic_years" DROP COLUMN "is_active";
--> statement-breakpoint
CREATE INDEX "academic_years_school_status_idx" ON "academic_years" USING btree ("school_id","status");
