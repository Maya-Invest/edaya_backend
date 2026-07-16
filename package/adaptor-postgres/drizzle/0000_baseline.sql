CREATE TABLE "academic_periods" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
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
CREATE TABLE "account_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"kind" text NOT NULL,
	"target_id" text NOT NULL,
	"contact_channel" text NOT NULL,
	"contact_value" text NOT NULL,
	"token_hash" text NOT NULL,
	"status" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"accepted_subject_id" text,
	"created_by_staff_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"last_sent_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "activities" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"coach" text NOT NULL,
	"schedule" text NOT NULL,
	"participants" integer NOT NULL,
	"capacity" integer NOT NULL,
	"description" text NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"student_id" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"schedule_id" text NOT NULL,
	"activity_id" text NOT NULL,
	"status" text NOT NULL,
	"is_exception" boolean NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"calendar_date" timestamp NOT NULL,
	"display_label" text NOT NULL,
	"notes" text,
	"created_at" timestamp NOT NULL
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
	"description" text,
	"attachments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lesson_session_id" text,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"due_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"owner_kind" text NOT NULL,
	"owner_id" text NOT NULL,
	"file_name" text NOT NULL,
	"storage_key" text,
	"file_url" text,
	"status" text DEFAULT 'ready' NOT NULL,
	"checksum" text,
	"mime_type" text,
	"size_bytes" integer,
	"uploaded_by_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attendance_records" (
	"id" text PRIMARY KEY NOT NULL,
	"student_id" text NOT NULL,
	"attendance_id" text,
	"lesson_session_id" text,
	"activity_session_id" text,
	"assessment_id" text,
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
CREATE TABLE "attendances" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"display_label" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calendar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"kind" text NOT NULL,
	"is_non_school_day" boolean NOT NULL,
	"scope_kind" text NOT NULL,
	"scope_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_activity_enrollments" (
	"id" text PRIMARY KEY NOT NULL,
	"activity_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"grade_level_id" text NOT NULL,
	"name" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"capacity" integer,
	"attendance_mode" text DEFAULT 'session' NOT NULL,
	"homeroom_staff_id" text,
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
	"lesson_session_id" text NOT NULL,
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
	"grade_level_subject_id" text,
	"coefficient" integer,
	"periods_per_week" integer,
	"min_period_span" integer,
	"max_period_span" integer,
	"is_offered" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"completed_percentage" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_job_schedules" (
	"id" text PRIMARY KEY NOT NULL,
	"job_key" text NOT NULL,
	"cron_expression" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"next_run_at" timestamp NOT NULL,
	"last_dispatched_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
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
CREATE TABLE "grade_level_subject_matters" (
	"id" text PRIMARY KEY NOT NULL,
	"grade_level_subject_id" text NOT NULL,
	"subject_matter_id" text NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_level_subjects" (
	"id" text PRIMARY KEY NOT NULL,
	"grade_level_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"coefficient" integer,
	"periods_per_week" integer,
	"min_period_span" integer,
	"max_period_span" integer,
	"is_optional" boolean DEFAULT false NOT NULL,
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
	"decimal_places" integer DEFAULT 1 NOT NULL,
	"description" text,
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
	"photo_url" text,
	"email" text,
	"phone" text,
	"notification_email" text,
	"notification_phone" text,
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
	"lesson_session_id" text,
	"status" text NOT NULL,
	"resolution_notes" text,
	"resolved_at" timestamp,
	"resolved_by_staff_id" text,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"schedule_id" text,
	"timetable_generated" text,
	"timetable_teacher_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"class_subject_id" text NOT NULL,
	"status" text NOT NULL,
	"is_exception" boolean NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"calendar_date" timestamp NOT NULL,
	"display_label" text NOT NULL,
	"session_note" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_deliveries" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"announcement_id" text,
	"event_key" text,
	"subject_id" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"recipient_kind" text,
	"recipient_id" text,
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
	"academic_year_id" text NOT NULL,
	"label" text NOT NULL,
	"day_of_week" text NOT NULL,
	"order_val" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"is_break" boolean DEFAULT false NOT NULL,
	"is_teaching_slot" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "report_card_definition_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"definition_id" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"coefficient" real,
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
	"grade_scale_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
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
	"published_at" timestamp,
	"aggregation" jsonb
);
--> statement-breakpoint
CREATE TABLE "resource_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"resource_id" text NOT NULL,
	"lesson_session_id" text,
	"activity_session_id" text,
	"assessment_id" text,
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
	"school_id" text NOT NULL,
	"class_group_id" text NOT NULL,
	"schedule_kind" text NOT NULL,
	"class_subject_id" text,
	"activity_id" text,
	"title" text NOT NULL,
	"is_recurring" boolean NOT NULL,
	"day_of_week" text,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"specific_date" timestamp,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "school_notification_templates" (
	"school_id" text PRIMARY KEY NOT NULL,
	"templates" jsonb NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"time_zone" text NOT NULL,
	"owner_subject_id" text,
	"type" text,
	"country" text,
	"city" text,
	"enforce_schedule_conflicts" boolean DEFAULT false NOT NULL,
	"timetable_enforce_workload_fulfillment" boolean DEFAULT true NOT NULL,
	"timetable_exclude_break_slots" boolean DEFAULT true NOT NULL,
	"timetable_min_day_gap_same_subject" integer DEFAULT 1 NOT NULL,
	"timetable_preferred_period_definition_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"timetable_allow_unassigned_teacher_placements" boolean DEFAULT false NOT NULL,
	"timetable_use_homeroom_teacher_fallback" boolean DEFAULT false NOT NULL,
	"timetable_generation_mode" text DEFAULT 'weekly' NOT NULL,
	"timetable_min_period_span" integer DEFAULT 1 NOT NULL,
	"timetable_max_period_span" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_member_id" text NOT NULL,
	"school_id" text NOT NULL,
	"key_prefix" text NOT NULL,
	"key_hash" text NOT NULL,
	"created_by_subject_id" text NOT NULL,
	"created_at" timestamp NOT NULL,
	"expires_at" timestamp,
	"revoked_at" timestamp,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "staff_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"academic_year_id" text,
	"role" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"class_group_id" text,
	"class_subject_id" text,
	"lesson_session_id" text,
	"activity_session_id" text,
	"assessment_id" text,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_members" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"photo_url" text,
	"email" text,
	"notification_email" text,
	"notification_phone" text,
	"subject_id" text,
	"account_kind" text DEFAULT 'human' NOT NULL,
	"service_id" text,
	"created_by_subject_id" text,
	"service_elevated" boolean DEFAULT false NOT NULL,
	"is_active" boolean NOT NULL,
	"onboarding_wizard_completed_at" timestamp,
	"onboarding_max_reached_step" integer,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staff_permission_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"staff_id" text NOT NULL,
	"school_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"permission" text NOT NULL,
	"scope_ids" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"source_staff_assignment_id" text,
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
	"medications" text,
	"clinical_notes" text,
	"last_visit" timestamp,
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
	"category" text DEFAULT 'work' NOT NULL,
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
	"category" text DEFAULT 'Scientifique' NOT NULL,
	"color" text DEFAULT 'mint' NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teacher_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"kind" text NOT NULL,
	"class_subject_id" text,
	"class_group_id" text,
	"responsibility" text,
	"status" text DEFAULT 'active' NOT NULL,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "teacher_unavailabilities" (
	"id" text PRIMARY KEY NOT NULL,
	"teacher_id" text NOT NULL,
	"academic_year_id" text NOT NULL,
	"recurrence" text NOT NULL,
	"day_of_week" text,
	"start_time" text,
	"end_time" text,
	"effective_from" timestamp,
	"effective_until" timestamp,
	"starts_at" timestamp,
	"ends_at" timestamp,
	"reason" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "teachers" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"photo_url" text,
	"email" text,
	"phone" text,
	"notification_email" text,
	"notification_phone" text,
	"subject_id" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "academic_periods_school_id_idx" ON "academic_periods" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "academic_periods_academic_year_id_idx" ON "academic_periods" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "academic_years_school_id_idx" ON "academic_years" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "academic_years_school_active_idx" ON "academic_years" USING btree ("school_id","is_active");--> statement-breakpoint
CREATE INDEX "activities_school_id_idx" ON "activities" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "activity_enrollments_activity_id_idx" ON "activity_enrollments" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "activity_enrollments_student_id_idx" ON "activity_enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "activity_sessions_class_group_id_idx" ON "activity_sessions" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "activity_sessions_school_id_idx" ON "activity_sessions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "activity_sessions_schedule_calendar_date_idx" ON "activity_sessions" USING btree ("schedule_id","calendar_date");--> statement-breakpoint
CREATE INDEX "announcement_targets_announcement_id_idx" ON "announcement_targets" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "announcements_school_id_idx" ON "announcements" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "assessment_results_student_id_idx" ON "assessment_results" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "assessment_results_assessment_id_idx" ON "assessment_results" USING btree ("assessment_id");--> statement-breakpoint
CREATE INDEX "assessments_class_group_id_idx" ON "assessments" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "assessments_class_subject_period_idx" ON "assessments" USING btree ("class_subject_id","period_id");--> statement-breakpoint
CREATE INDEX "assessments_period_id_idx" ON "assessments" USING btree ("period_id");--> statement-breakpoint
CREATE INDEX "attachments_school_id_idx" ON "attachments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "attachments_owner_idx" ON "attachments" USING btree ("owner_kind","owner_id");--> statement-breakpoint
CREATE INDEX "attendance_records_student_id_idx" ON "attendance_records" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "attendance_records_attendance_id_idx" ON "attendance_records" USING btree ("attendance_id");--> statement-breakpoint
CREATE INDEX "attendance_records_lesson_session_id_idx" ON "attendance_records" USING btree ("lesson_session_id");--> statement-breakpoint
CREATE INDEX "attendances_class_group_id_idx" ON "attendances" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "attendances_school_id_idx" ON "attendances" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "calendar_events_school_year_idx" ON "calendar_events" USING btree ("school_id","academic_year_id");--> statement-breakpoint
CREATE INDEX "class_activity_enrollments_activity_id_idx" ON "class_activity_enrollments" USING btree ("activity_id");--> statement-breakpoint
CREATE INDEX "class_activity_enrollments_class_group_id_idx" ON "class_activity_enrollments" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "class_groups_school_id_idx" ON "class_groups" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "class_groups_academic_year_id_idx" ON "class_groups" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "class_groups_grade_level_id_idx" ON "class_groups" USING btree ("grade_level_id");--> statement-breakpoint
CREATE INDEX "class_subject_matters_class_subject_id_idx" ON "class_subject_matters" USING btree ("class_subject_id");--> statement-breakpoint
CREATE INDEX "class_subjects_class_group_id_idx" ON "class_subjects" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "class_subjects_subject_id_idx" ON "class_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cron_job_schedules_job_key_idx" ON "cron_job_schedules" USING btree ("job_key");--> statement-breakpoint
CREATE INDEX "cron_job_schedules_due_idx" ON "cron_job_schedules" USING btree ("enabled","next_run_at");--> statement-breakpoint
CREATE INDEX "disciplinary_actions_school_id_idx" ON "disciplinary_actions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "fees_school_id_idx" ON "fees" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "fees_academic_year_id_idx" ON "fees" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "grade_levels_school_id_idx" ON "grade_levels" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "grade_scales_school_id_idx" ON "grade_scales" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "guardian_student_links_guardian_id_idx" ON "guardian_student_links" USING btree ("guardian_id");--> statement-breakpoint
CREATE INDEX "guardian_student_links_student_id_idx" ON "guardian_student_links" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "guardian_student_links_school_id_idx" ON "guardian_student_links" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "guardians_school_id_idx" ON "guardians" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "incidents_school_id_idx" ON "incidents" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "incidents_class_group_id_idx" ON "incidents" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "lesson_sessions_class_group_id_idx" ON "lesson_sessions" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "lesson_sessions_school_id_idx" ON "lesson_sessions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "lesson_sessions_schedule_calendar_date_idx" ON "lesson_sessions" USING btree ("schedule_id","calendar_date");--> statement-breakpoint
CREATE INDEX "message_deliveries_school_id_idx" ON "message_deliveries" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "message_deliveries_announcement_id_idx" ON "message_deliveries" USING btree ("announcement_id");--> statement-breakpoint
CREATE INDEX "message_deliveries_subject_id_idx" ON "message_deliveries" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "payments_student_fee_id_idx" ON "payments" USING btree ("student_fee_id");--> statement-breakpoint
CREATE INDEX "period_definitions_academic_year_id_idx" ON "period_definitions" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "report_card_definition_sections_definition_id_idx" ON "report_card_definition_sections" USING btree ("definition_id");--> statement-breakpoint
CREATE INDEX "report_card_definition_sections_parent_section_id_idx" ON "report_card_definition_sections" USING btree ("parent_section_id");--> statement-breakpoint
CREATE INDEX "report_card_definitions_school_id_idx" ON "report_card_definitions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "report_card_definitions_academic_year_id_idx" ON "report_card_definitions" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "report_card_results_student_id_idx" ON "report_card_results" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "report_card_results_definition_id_idx" ON "report_card_results" USING btree ("report_card_definition_id");--> statement-breakpoint
CREATE INDEX "report_card_results_class_group_period_idx" ON "report_card_results" USING btree ("class_group_id","period_id");--> statement-breakpoint
CREATE INDEX "resource_assignments_resource_id_idx" ON "resource_assignments" USING btree ("resource_id");--> statement-breakpoint
CREATE INDEX "resources_school_id_idx" ON "resources" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "schedules_class_group_id_idx" ON "schedules" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "schedules_school_id_idx" ON "schedules" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "service_api_keys_staff_member_id_idx" ON "service_api_keys" USING btree ("staff_member_id");--> statement-breakpoint
CREATE INDEX "staff_assignments_staff_id_idx" ON "staff_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_assignments_class_group_id_idx" ON "staff_assignments" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "staff_members_school_id_idx" ON "staff_members" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "staff_members_subject_id_idx" ON "staff_members" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "staff_permission_assignments_staff_id_idx" ON "staff_permission_assignments" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "staff_permission_assignments_school_id_idx" ON "staff_permission_assignments" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "staff_permission_assignments_academic_year_id_idx" ON "staff_permission_assignments" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "student_class_enrollments_student_id_idx" ON "student_class_enrollments" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_class_enrollments_class_group_id_idx" ON "student_class_enrollments" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "student_class_enrollments_academic_year_id_idx" ON "student_class_enrollments" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "student_class_enrollments_student_status_idx" ON "student_class_enrollments" USING btree ("student_id","status");--> statement-breakpoint
CREATE INDEX "student_class_enrollments_class_group_status_idx" ON "student_class_enrollments" USING btree ("class_group_id","status");--> statement-breakpoint
CREATE INDEX "student_class_enrollments_student_class_group_idx" ON "student_class_enrollments" USING btree ("student_id","class_group_id");--> statement-breakpoint
CREATE INDEX "student_disciplinary_actions_school_id_idx" ON "student_disciplinary_actions" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "student_disciplinary_actions_student_id_idx" ON "student_disciplinary_actions" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_disciplinary_actions_incident_id_idx" ON "student_disciplinary_actions" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "student_fees_student_id_idx" ON "student_fees" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_fees_fee_id_idx" ON "student_fees" USING btree ("fee_id");--> statement-breakpoint
CREATE INDEX "student_fees_academic_year_id_idx" ON "student_fees" USING btree ("academic_year_id");--> statement-breakpoint
CREATE INDEX "student_health_profiles_student_id_idx" ON "student_health_profiles" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_incident_involvements_student_id_idx" ON "student_incident_involvements" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_incident_involvements_incident_id_idx" ON "student_incident_involvements" USING btree ("incident_id");--> statement-breakpoint
CREATE INDEX "student_notes_student_id_idx" ON "student_notes" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "student_notes_school_id_idx" ON "student_notes" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "students_school_id_idx" ON "students" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "subject_matters_subject_id_idx" ON "subject_matters" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "subjects_school_id_idx" ON "subjects" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "teacher_unavailabilities_teacher_id_idx" ON "teacher_unavailabilities" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "teacher_unavailabilities_academic_year_id_idx" ON "teacher_unavailabilities" USING btree ("academic_year_id");