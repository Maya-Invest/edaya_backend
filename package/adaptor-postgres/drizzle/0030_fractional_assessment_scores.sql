ALTER TABLE "assessments" ALTER COLUMN "max_score" SET DATA TYPE numeric(8, 2) USING "max_score"::numeric(8, 2);
--> statement-breakpoint
ALTER TABLE "assessments" ALTER COLUMN "coefficient" SET DATA TYPE numeric(8, 2) USING "coefficient"::numeric(8, 2);
--> statement-breakpoint
ALTER TABLE "assessment_results" ALTER COLUMN "score" SET DATA TYPE numeric(8, 2) USING "score"::numeric(8, 2);
