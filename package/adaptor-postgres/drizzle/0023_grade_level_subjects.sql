CREATE TABLE "grade_level_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"grade_level_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"coefficient" integer,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "grade_level_subjects_grade_year_subject_uidx" ON "grade_level_subjects" ("grade_level_id","academic_year_id","subject_id");
--> statement-breakpoint
CREATE TABLE "grade_level_subject_matters" (
	"id" text PRIMARY KEY NOT NULL,
	"grade_level_subject_id" text NOT NULL,
	"subject_matter_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "grade_level_subject_matters_gls_matter_uidx" ON "grade_level_subject_matters" ("grade_level_subject_id","subject_matter_id");
--> statement-breakpoint
ALTER TABLE "class_subjects" ADD COLUMN "grade_level_subject_id" text;
--> statement-breakpoint
CREATE INDEX "class_subjects_grade_level_subject_id_idx" ON "class_subjects" ("grade_level_subject_id");
