ALTER TABLE "extracurricular_activities" RENAME TO "activities";
--> statement-breakpoint
ALTER INDEX "extracurricular_activities_school_id_idx" RENAME TO "activities_school_id_idx";
