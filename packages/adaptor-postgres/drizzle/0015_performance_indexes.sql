-- Query-performance indexes for common repository list() filters.
-- Safe to run on existing Neon branches; only adds indexes (no data changes).

--> statement-breakpoint
CREATE INDEX "academic_years_school_id_idx" ON "academic_years" ("school_id");
--> statement-breakpoint
CREATE INDEX "academic_years_school_active_idx" ON "academic_years" ("school_id", "is_active");
--> statement-breakpoint
CREATE INDEX "academic_periods_school_id_idx" ON "academic_periods" ("school_id");
--> statement-breakpoint
CREATE INDEX "academic_periods_academic_year_id_idx" ON "academic_periods" ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "period_definitions_academic_year_id_idx" ON "period_definitions" ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "grade_levels_school_id_idx" ON "grade_levels" ("school_id");
--> statement-breakpoint
CREATE INDEX "staff_members_school_id_idx" ON "staff_members" ("school_id");
--> statement-breakpoint
CREATE INDEX "staff_members_subject_id_idx" ON "staff_members" ("subject_id");
--> statement-breakpoint
CREATE INDEX "service_api_keys_staff_member_id_idx" ON "service_api_keys" ("staff_member_id");
--> statement-breakpoint
CREATE INDEX "staff_assignments_staff_id_idx" ON "staff_assignments" ("staff_id");
--> statement-breakpoint
CREATE INDEX "staff_assignments_class_group_id_idx" ON "staff_assignments" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "access_roles_school_id_idx" ON "access_roles" ("school_id");
--> statement-breakpoint
CREATE INDEX "access_role_permissions_role_id_idx" ON "access_role_permissions" ("role_id");
--> statement-breakpoint
CREATE INDEX "staff_role_assignments_staff_id_idx" ON "staff_role_assignments" ("staff_id");
--> statement-breakpoint
CREATE INDEX "staff_role_assignments_school_id_idx" ON "staff_role_assignments" ("school_id");
--> statement-breakpoint
CREATE INDEX "staff_role_assignment_roles_assignment_id_idx" ON "staff_role_assignment_roles" ("assignment_id");
--> statement-breakpoint
CREATE INDEX "staff_role_assignment_roles_role_id_idx" ON "staff_role_assignment_roles" ("role_id");
--> statement-breakpoint
CREATE INDEX "attachments_school_id_idx" ON "attachments" ("school_id");
--> statement-breakpoint
CREATE INDEX "attachments_owner_idx" ON "attachments" ("owner_kind", "owner_id");
--> statement-breakpoint
CREATE INDEX "resources_school_id_idx" ON "resources" ("school_id");
--> statement-breakpoint
CREATE INDEX "resource_assignments_resource_id_idx" ON "resource_assignments" ("resource_id");
--> statement-breakpoint
CREATE INDEX "fees_school_id_idx" ON "fees" ("school_id");
--> statement-breakpoint
CREATE INDEX "fees_academic_year_id_idx" ON "fees" ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "student_fees_student_id_idx" ON "student_fees" ("student_id");
--> statement-breakpoint
CREATE INDEX "student_fees_fee_id_idx" ON "student_fees" ("fee_id");
--> statement-breakpoint
CREATE INDEX "student_fees_academic_year_id_idx" ON "student_fees" ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "payments_student_fee_id_idx" ON "payments" ("student_fee_id");
--> statement-breakpoint
CREATE INDEX "schedules_class_group_id_idx" ON "schedules" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "sessions_class_group_id_idx" ON "sessions" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "calendar_events_school_year_idx" ON "calendar_events" ("school_id", "academic_year_id");
--> statement-breakpoint
CREATE INDEX "attendance_records_student_id_idx" ON "attendance_records" ("student_id");
--> statement-breakpoint
CREATE INDEX "attendance_records_session_id_idx" ON "attendance_records" ("session_id");
--> statement-breakpoint
CREATE INDEX "announcements_school_id_idx" ON "announcements" ("school_id");
--> statement-breakpoint
CREATE INDEX "announcement_targets_announcement_id_idx" ON "announcement_targets" ("announcement_id");
--> statement-breakpoint
CREATE INDEX "message_deliveries_announcement_id_idx" ON "message_deliveries" ("announcement_id");
--> statement-breakpoint
CREATE INDEX "subjects_school_id_idx" ON "subjects" ("school_id");
--> statement-breakpoint
CREATE INDEX "subject_matters_subject_id_idx" ON "subject_matters" ("subject_id");
--> statement-breakpoint
CREATE INDEX "class_groups_school_id_idx" ON "class_groups" ("school_id");
--> statement-breakpoint
CREATE INDEX "class_groups_academic_year_id_idx" ON "class_groups" ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "class_groups_grade_level_id_idx" ON "class_groups" ("grade_level_id");
--> statement-breakpoint
CREATE INDEX "class_subjects_class_group_id_idx" ON "class_subjects" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "class_subjects_subject_id_idx" ON "class_subjects" ("subject_id");
--> statement-breakpoint
CREATE INDEX "homework_assignments_class_group_id_idx" ON "homework_assignments" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "class_logbook_entries_class_group_id_idx" ON "class_logbook_entries" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "homework_submissions_assignment_id_idx" ON "homework_submissions" ("homework_assignment_id");
--> statement-breakpoint
CREATE INDEX "homework_submissions_student_id_idx" ON "homework_submissions" ("student_id");
--> statement-breakpoint
CREATE INDEX "extracurricular_activities_school_id_idx" ON "extracurricular_activities" ("school_id");
--> statement-breakpoint
CREATE INDEX "activity_enrollments_activity_id_idx" ON "activity_enrollments" ("activity_id");
--> statement-breakpoint
CREATE INDEX "activity_enrollments_student_id_idx" ON "activity_enrollments" ("student_id");
--> statement-breakpoint
CREATE INDEX "class_subject_matters_class_subject_id_idx" ON "class_subject_matters" ("class_subject_id");
--> statement-breakpoint
CREATE INDEX "assessments_class_group_id_idx" ON "assessments" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "assessments_class_subject_period_idx" ON "assessments" ("class_subject_id", "period_id");
--> statement-breakpoint
CREATE INDEX "assessments_period_id_idx" ON "assessments" ("period_id");
--> statement-breakpoint
CREATE INDEX "assessment_results_student_id_idx" ON "assessment_results" ("student_id");
--> statement-breakpoint
CREATE INDEX "assessment_results_assessment_id_idx" ON "assessment_results" ("assessment_id");
--> statement-breakpoint
CREATE INDEX "grade_scales_school_id_idx" ON "grade_scales" ("school_id");
--> statement-breakpoint
CREATE INDEX "report_card_definitions_school_id_idx" ON "report_card_definitions" ("school_id");
--> statement-breakpoint
CREATE INDEX "report_card_definitions_academic_year_id_idx" ON "report_card_definitions" ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "report_card_definition_sections_definition_id_idx" ON "report_card_definition_sections" ("definition_id");
--> statement-breakpoint
CREATE INDEX "report_card_definition_sections_parent_section_id_idx" ON "report_card_definition_sections" ("parent_section_id");
--> statement-breakpoint
CREATE INDEX "report_card_results_student_id_idx" ON "report_card_results" ("student_id");
--> statement-breakpoint
CREATE INDEX "report_card_results_definition_id_idx" ON "report_card_results" ("report_card_definition_id");
--> statement-breakpoint
CREATE INDEX "report_card_results_class_group_period_idx" ON "report_card_results" ("class_group_id", "period_id");
--> statement-breakpoint
CREATE INDEX "students_school_id_idx" ON "students" ("school_id");
--> statement-breakpoint
CREATE INDEX "student_class_enrollments_student_id_idx" ON "student_class_enrollments" ("student_id");
--> statement-breakpoint
CREATE INDEX "student_class_enrollments_class_group_id_idx" ON "student_class_enrollments" ("class_group_id");
--> statement-breakpoint
CREATE INDEX "student_class_enrollments_academic_year_id_idx" ON "student_class_enrollments" ("academic_year_id");
--> statement-breakpoint
CREATE INDEX "student_class_enrollments_student_status_idx" ON "student_class_enrollments" ("student_id", "status");
--> statement-breakpoint
CREATE INDEX "student_class_enrollments_class_group_status_idx" ON "student_class_enrollments" ("class_group_id", "status");
--> statement-breakpoint
CREATE INDEX "student_class_enrollments_student_class_group_idx" ON "student_class_enrollments" ("student_id", "class_group_id");
--> statement-breakpoint
CREATE INDEX "guardians_school_id_idx" ON "guardians" ("school_id");
--> statement-breakpoint
CREATE INDEX "guardian_student_links_guardian_id_idx" ON "guardian_student_links" ("guardian_id");
--> statement-breakpoint
CREATE INDEX "guardian_student_links_student_id_idx" ON "guardian_student_links" ("student_id");
--> statement-breakpoint
CREATE INDEX "guardian_student_links_school_id_idx" ON "guardian_student_links" ("school_id");
--> statement-breakpoint
CREATE INDEX "student_notes_student_id_idx" ON "student_notes" ("student_id");
--> statement-breakpoint
CREATE INDEX "student_notes_school_id_idx" ON "student_notes" ("school_id");
--> statement-breakpoint
CREATE INDEX "student_health_profiles_student_id_idx" ON "student_health_profiles" ("student_id");
--> statement-breakpoint
CREATE INDEX "student_disciplinary_actions_school_id_idx" ON "student_disciplinary_actions" ("school_id");
--> statement-breakpoint
CREATE INDEX "student_disciplinary_actions_student_id_idx" ON "student_disciplinary_actions" ("student_id");
--> statement-breakpoint
CREATE INDEX "student_disciplinary_actions_incident_id_idx" ON "student_disciplinary_actions" ("incident_id");
--> statement-breakpoint
CREATE INDEX "disciplinary_actions_school_id_idx" ON "disciplinary_actions" ("school_id");
--> statement-breakpoint
CREATE INDEX "student_incident_involvements_student_id_idx" ON "student_incident_involvements" ("student_id");
--> statement-breakpoint
CREATE INDEX "student_incident_involvements_incident_id_idx" ON "student_incident_involvements" ("incident_id");
--> statement-breakpoint
CREATE INDEX "incidents_school_id_idx" ON "incidents" ("school_id");
--> statement-breakpoint
CREATE INDEX "incidents_class_group_id_idx" ON "incidents" ("class_group_id");
