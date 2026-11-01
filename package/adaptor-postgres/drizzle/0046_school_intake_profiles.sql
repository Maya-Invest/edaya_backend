ALTER TABLE "students" ADD COLUMN "national_matricule" text;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "source_full_name" text;
--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "occupation" text;
--> statement-breakpoint
ALTER TABLE "guardians" ADD COLUMN "source_full_name" text;
--> statement-breakpoint
ALTER TABLE "teachers" ADD COLUMN "source_full_name" text;
--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "discipline_id" text;
--> statement-breakpoint
CREATE TABLE "academic_disciplines" (
 "id" text PRIMARY KEY NOT NULL, "school_id" text NOT NULL, "code" text NOT NULL,
 "name" text NOT NULL, "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp NOT NULL, "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "academic_disciplines_school_code_unique" ON "academic_disciplines" ("school_id", lower("code"));
--> statement-breakpoint
CREATE TABLE "placement_statuses" (
 "id" text PRIMARY KEY NOT NULL, "school_id" text NOT NULL, "code" text NOT NULL,
 "label" text NOT NULL, "is_active" boolean DEFAULT true NOT NULL,
 "created_at" timestamp NOT NULL, "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "placement_statuses_school_code_unique" ON "placement_statuses" ("school_id", lower("code"));
--> statement-breakpoint
CREATE TABLE "student_academic_year_profiles" (
 "id" text PRIMARY KEY NOT NULL, "school_id" text NOT NULL, "student_id" text NOT NULL,
 "academic_year_id" text NOT NULL, "placement_status_id" text, "is_repeating" boolean,
 "created_at" timestamp NOT NULL, "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "student_academic_year_profiles_person_year_unique" ON "student_academic_year_profiles" ("school_id", "student_id", "academic_year_id");
--> statement-breakpoint
CREATE INDEX "student_academic_year_profiles_school_year_idx" ON "student_academic_year_profiles" ("school_id", "academic_year_id");
--> statement-breakpoint
CREATE TABLE "teacher_academic_year_profiles" (
 "id" text PRIMARY KEY NOT NULL, "school_id" text NOT NULL, "teacher_id" text NOT NULL,
 "academic_year_id" text NOT NULL, "discipline_ids" jsonb DEFAULT '[]'::jsonb NOT NULL, "declared_hours" double precision,
 "hours_period" text DEFAULT 'unspecified' NOT NULL, "hours_period_label" text,
 "created_at" timestamp NOT NULL, "updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "teacher_academic_year_profiles_person_year_unique" ON "teacher_academic_year_profiles" ("school_id", "teacher_id", "academic_year_id");
--> statement-breakpoint
CREATE INDEX "teacher_academic_year_profiles_school_year_idx" ON "teacher_academic_year_profiles" ("school_id", "academic_year_id");
