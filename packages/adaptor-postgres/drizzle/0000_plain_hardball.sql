CREATE TABLE "academic_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic_years" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_active" boolean NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_role_permissions" (
	"role_id" text NOT NULL,
	"permission" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "access_roles" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcement_targets" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"target_kind" text NOT NULL,
	"target_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"created_by" text,
	"status" text NOT NULL,
	"priority" text NOT NULL,
	"premium_notification" boolean NOT NULL,
	"created_at" timestamp NOT NULL,
	"published_at" timestamp,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "assessment_results" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"assessment_id" text NOT NULL,
	"score" integer,
	"status" text,
	"notes" text,
	"created_by" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "assessments" (
	"id" text PRIMARY KEY NOT NULL,
	"class_group_id" text NOT NULL,
	"class_subject_id" text NOT NULL,
	"period_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"max_score" integer NOT NULL,
	"coefficient" integer NOT NULL,
	"session_id" text,
	"due_at" timestamp,
	"met_at" timestamp,
	"date" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"owner_kind" text NOT NULL,
	"owner_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"uploaded_by_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"session_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"status" text NOT NULL,
	"justification_status" text NOT NULL,
	"reason" text,
	"notes" text,
	"justified_at" timestamp,
	"justified_by_staff_id" text,
	"corrected_at" timestamp,
	"corrected_by_staff_id" text,
	"created_by" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"title" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"kind" text NOT NULL,
	"is_non_school_day" boolean NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"grade_level_id" text NOT NULL,
	"name" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_subject_matters" (
	"id" text PRIMARY KEY NOT NULL,
	"class_subject_id" text NOT NULL,
	"subject_matter_id" text NOT NULL,
	"status" text NOT NULL,
	"completed_percentage" integer NOT NULL,
	"updated_by_staff_id" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"notes" text,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_subject_progress" (
	"id" text PRIMARY KEY NOT NULL,
	"class_subject_matter_id" text NOT NULL,
	"session_id" text NOT NULL,
	"completed_percentage" integer NOT NULL,
	"recorded_by_staff_id" text,
	"notes" text,
	"recorded_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"class_group_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"coefficient" integer,
	"created_at" timestamp NOT NULL,
	"completed_percentage" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disciplinary_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fees" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text,
	"default_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"installments" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_levels" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"order_val" integer NOT NULL,
	"cycle" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_scales" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"min_score" integer NOT NULL,
	"max_score" integer NOT NULL,
	"ranges" jsonb NOT NULL,
	"is_default" boolean NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardian_student_links" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"guardian_id" text NOT NULL,
	"student_id" text NOT NULL,
	"relationship" text NOT NULL,
	"is_primary" boolean NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guardians" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"phone" text,
	"subject_id" text,
	"contact_methods" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"date" timestamp NOT NULL,
	"kind" text NOT NULL,
	"reporter_id" text NOT NULL,
	"class_group_id" text,
	"session_id" text,
	"status" text NOT NULL,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"resolved_by_staff_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"announcement_id" text NOT NULL,
	"recipient_kind" text NOT NULL,
	"recipient_id" text NOT NULL,
	"channel" text NOT NULL,
	"status" text NOT NULL,
	"provider_message_id" text,
	"failure_reason" text,
	"sent_at" timestamp,
	"read_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"student_fee_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"payment_date" timestamp NOT NULL,
	"method" text NOT NULL,
	"status" text NOT NULL,
	"reference" text,
	"notes" text,
	"recorded_by_id" text,
	"reversed_at" timestamp,
	"reversed_by_id" text,
	"cancelled_at" timestamp,
	"cancelled_by_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "period_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_card_definition_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"definition_id" text NOT NULL,
	"name" text NOT NULL,
	"order_val" integer NOT NULL,
	"weight" integer NOT NULL,
	"parent_section_id" text,
	"subject_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_card_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"grade_level_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"is_default" boolean NOT NULL,
	"description" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_card_results" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"period_id" text NOT NULL,
	"report_card_definition_id" text NOT NULL,
	"section_results" jsonb NOT NULL,
	"attendance_summary" jsonb NOT NULL,
	"assessment_result_count" integer NOT NULL,
	"overall_average" integer,
	"rank" integer,
	"class_size" integer,
	"pass_threshold" integer,
	"teacher_comment" text,
	"principal_comment" text,
	"status" text NOT NULL,
	"generated_at" timestamp NOT NULL,
	"published_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "resource_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"session_id" text,
	"class_group_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resources" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kind" text NOT NULL,
	"capacity" integer,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"class_group_id" text NOT NULL,
	"class_subject_id" text,
	"title" text NOT NULL,
	"is_recurring" boolean NOT NULL,
	"day_of_week" text,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"specific_date" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"time_zone" text NOT NULL,
	"owner_staff_id" text,
	"type" text,
	"country" text,
	"city" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"class_group_id" text NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"class_subject_id" text,
	"schedule_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"role" text NOT NULL,
	"class_group_id" text,
	"class_subject_id" text,
	"session_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text,
	"subject_id" text,
	"is_active" boolean NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignment_roles" (
	"assignment_id" text NOT NULL,
	"role_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignment_scope_grants" (
	"assignment_id" text NOT NULL,
	"permission" text NOT NULL,
	"scope_type" text NOT NULL,
	"scope_entity_ids" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_role_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text,
	"status" text NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_class_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"enrollment_index" integer NOT NULL,
	"status" text NOT NULL,
	"enrolled_at" timestamp NOT NULL,
	"ended_at" timestamp,
	"end_reason" text,
	"progression_decision" text,
	"previous_enrollment_id" text,
	"closed_by" text,
	"progression_decided_at" timestamp,
	"progression_decided_by" text,
	"progression_notes" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_disciplinary_actions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"student_id" text NOT NULL,
	"disciplinary_action_id" text NOT NULL,
	"assigned_by_staff_id" text NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"status" text NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_fees" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"fee_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"expected_amount" integer NOT NULL,
	"paid_amount" integer NOT NULL,
	"adjustment_amount" integer NOT NULL,
	"adjustment_reason" text,
	"adjusted_by_id" text,
	"adjusted_at" timestamp,
	"currency" text NOT NULL,
	"due_date" timestamp,
	"status" text NOT NULL,
	"cancellation_reason" text,
	"cancelled_by_id" text,
	"cancelled_at" timestamp,
	"installments" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "student_health_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"blood_type" text,
	"allergies" jsonb NOT NULL,
	"medical_conditions" jsonb NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_incident_involvements" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"incident_id" text NOT NULL,
	"role" text NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_notes" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"student_id" text NOT NULL,
	"author_staff_id" text NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"visibility" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"gender" text,
	"birth_date" timestamp,
	"place_of_birth" text,
	"nationality" text,
	"matricule" text,
	"photo_url" text,
	"subject_id" text,
	"status" text NOT NULL,
	"enrollment_date" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subject_matters" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sequence_order" integer NOT NULL,
	"estimated_hours" integer,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"default_coefficient" integer,
	"created_at" timestamp NOT NULL
);
