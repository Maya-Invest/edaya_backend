import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { index, uniqueIndex } from 'drizzle-orm/pg-core'

function col(table: Record<string, AnyPgColumn>, name: string): AnyPgColumn {
  return table[name]!
}

export function definePerformanceIndexes(tableName: string, table: Record<string, AnyPgColumn>) {
  switch (tableName) {
    case 'academic_years':
      return [
        index('academic_years_school_id_idx').on(col(table, 'schoolId')),
        index('academic_years_school_status_idx').on(col(table, 'schoolId'), col(table, 'status')),
      ]
    case 'academic_periods':
      return [
        index('academic_periods_school_id_idx').on(col(table, 'schoolId')),
        index('academic_periods_academic_year_id_idx').on(col(table, 'academicYearId')),
      ]
    case 'period_definitions':
      return [index('period_definitions_academic_year_id_idx').on(col(table, 'academicYearId'))]
    case 'grade_levels':
      return [index('grade_levels_school_id_idx').on(col(table, 'schoolId'))]
    case 'staff_members':
      return [
        index('staff_members_school_id_idx').on(col(table, 'schoolId')),
        index('staff_members_subject_id_idx').on(col(table, 'subjectId')),
        uniqueIndex('staff_members_school_code_uidx').on(col(table, 'schoolId'), col(table, 'code')),
        uniqueIndex('staff_members_school_subject_uidx')
          .on(col(table, 'schoolId'), col(table, 'subjectId'))
          .where(sql`${col(table, 'subjectId')} is not null`),
      ]
    case 'service_api_keys':
      return [index('service_api_keys_staff_member_id_idx').on(col(table, 'staffMemberId'))]
    case 'staff_assignments':
      return [
        index('staff_assignments_staff_id_idx').on(col(table, 'staffId')),
        index('staff_assignments_class_group_id_idx').on(col(table, 'classGroupId')),
      ]
    case 'staff_permission_assignments':
      return [
        index('staff_permission_assignments_staff_id_idx').on(col(table, 'staffId')),
        index('staff_permission_assignments_school_id_idx').on(col(table, 'schoolId')),
        index('staff_permission_assignments_academic_year_id_idx').on(col(table, 'academicYearId')),
        index('staff_permission_assignments_source_profile_id_idx').on(col(table, 'sourceProfileId')),
      ]
    case 'staff_permission_scope_defaults':
      return [uniqueIndex('staff_permission_scope_defaults_staff_year_uidx').on(col(table, 'schoolId'), col(table, 'staffId'), col(table, 'academicYearId'))]
    case 'staff_manual_permission_assignments':
      return [index('staff_manual_permission_assignments_staff_year_idx').on(col(table, 'schoolId'), col(table, 'staffId'), col(table, 'academicYearId'))]
    case 'staff_permission_profiles':
      return [
        index('staff_permission_profiles_school_id_idx').on(col(table, 'schoolId')),
        uniqueIndex('staff_permission_profiles_source_key_uidx')
          .on(col(table, 'schoolId'), col(table, 'sourceKey'))
          .where(sql`${col(table, 'sourceKey')} is not null`),
      ]
    case 'staff_permission_profile_bindings':
      return [
        index('staff_permission_profile_bindings_school_id_idx').on(col(table, 'schoolId')),
        index('staff_permission_profile_bindings_staff_id_idx').on(col(table, 'staffId')),
        index('staff_permission_profile_bindings_profile_id_idx').on(col(table, 'profileId')),
        uniqueIndex('staff_permission_profile_bindings_staff_profile_uidx').on(col(table, 'staffId'), col(table, 'profileId'), col(table, 'academicYearId')),
        uniqueIndex('staff_permission_profile_bindings_sort_uidx').on(
          col(table, 'staffId'),
          col(table, 'academicYearId'),
          col(table, 'sortOrder'),
        ),
      ]
    case 'attachments':
      return [
        index('attachments_school_id_idx').on(col(table, 'schoolId')),
        index('attachments_owner_idx').on(col(table, 'ownerKind'), col(table, 'ownerId')),
      ]
    case 'resources':
      return [index('resources_school_id_idx').on(col(table, 'schoolId'))]
    case 'resource_assignments':
      return [index('resource_assignments_resource_id_idx').on(col(table, 'resourceId'))]
    case 'catalog_services':
      return [
        index('catalog_services_school_id_idx').on(col(table, 'schoolId')),
        index('catalog_services_academic_year_id_idx').on(col(table, 'academicYearId')),
        index('catalog_services_school_status_idx').on(col(table, 'schoolId'), col(table, 'status')),
      ]
    case 'student_service_enrollments':
      return [
        index('student_service_enrollments_school_id_idx').on(col(table, 'schoolId')),
        index('student_service_enrollments_student_id_idx').on(col(table, 'studentId')),
        index('student_service_enrollments_catalog_service_id_idx').on(col(table, 'catalogServiceId')),
        uniqueIndex('student_service_enrollments_active_uidx')
          .on(col(table, 'studentId'), col(table, 'catalogServiceId'), col(table, 'academicYearId'))
          .where(sql`${col(table, 'status')} = 'active'`),
      ]
    case 'student_charges':
      return [
        index('student_charges_school_id_idx').on(col(table, 'schoolId')),
        index('student_charges_student_id_idx').on(col(table, 'studentId')),
        uniqueIndex('student_charges_enrollment_uidx').on(col(table, 'enrollmentId')),
        index('student_charges_academic_year_id_idx').on(col(table, 'academicYearId')),
        index('student_charges_status_idx').on(col(table, 'schoolId'), col(table, 'status')),
      ]
    case 'student_year_accounts':
      return [
        index('student_year_accounts_school_id_idx').on(col(table, 'schoolId')),
        index('student_year_accounts_student_id_idx').on(col(table, 'studentId')),
        uniqueIndex('student_year_accounts_identity_uidx').on(
          col(table, 'schoolId'),
          col(table, 'studentId'),
          col(table, 'academicYearId'),
          col(table, 'currency'),
        ),
      ]
    case 'payments':
      return [
        index('payments_school_id_idx').on(col(table, 'schoolId')),
        index('payments_account_id_idx').on(col(table, 'accountId')),
        uniqueIndex('payments_reference_uidx')
          .on(col(table, 'schoolId'), col(table, 'academicYearId'), col(table, 'reference'))
          .where(sql`${col(table, 'reference')} is not null`),
      ]
    case 'allocations':
      return [
        index('allocations_school_id_idx').on(col(table, 'schoolId')),
        index('allocations_account_id_idx').on(col(table, 'accountId')),
        index('allocations_charge_id_idx').on(col(table, 'chargeId')),
        uniqueIndex('allocations_reverse_uidx')
          .on(col(table, 'reversesAllocationId'))
          .where(sql`${col(table, 'kind')} = 'reverse'`),
      ]
    case 'student_account_entries':
      return [
        index('student_account_entries_school_id_idx').on(col(table, 'schoolId')),
        index('student_account_entries_account_id_idx').on(col(table, 'accountId')),
        index('student_account_entries_recorded_at_idx').on(col(table, 'accountId'), col(table, 'recordedAt')),
      ]
    case 'schedules':
      return [
        index('schedules_class_group_id_idx').on(col(table, 'classGroupId')),
        index('schedules_school_id_idx').on(col(table, 'schoolId')),
      ]
    case 'lesson_sessions':
      return [
        index('lesson_sessions_class_group_id_idx').on(col(table, 'classGroupId')),
        index('lesson_sessions_school_id_idx').on(col(table, 'schoolId')),
        index('lesson_sessions_schedule_calendar_date_idx').on(col(table, 'scheduleId'), col(table, 'calendarDate')),
      ]
    case 'activity_sessions':
      return [
        index('activity_sessions_class_group_id_idx').on(col(table, 'classGroupId')),
        index('activity_sessions_school_id_idx').on(col(table, 'schoolId')),
        index('activity_sessions_schedule_calendar_date_idx').on(col(table, 'scheduleId'), col(table, 'calendarDate')),
      ]
    case 'attendances':
      return [
        index('attendances_class_group_id_idx').on(col(table, 'classGroupId')),
        index('attendances_school_id_idx').on(col(table, 'schoolId')),
      ]
    case 'calendar_events':
      return [index('calendar_events_school_year_idx').on(col(table, 'schoolId'), col(table, 'academicYearId'))]
    case 'attendance_records':
      return [
        index('attendance_records_student_id_idx').on(col(table, 'studentId')),
        index('attendance_records_attendance_id_idx').on(col(table, 'attendanceId')),
        index('attendance_records_lesson_session_id_idx').on(col(table, 'lessonSessionId')),
      ]
    case 'announcements':
      return [index('announcements_school_id_idx').on(col(table, 'schoolId'))]
    case 'announcement_targets':
      return [index('announcement_targets_announcement_id_idx').on(col(table, 'announcementId'))]
    case 'message_deliveries':
      return [
        index('message_deliveries_school_id_idx').on(col(table, 'schoolId')),
        index('message_deliveries_announcement_id_idx').on(col(table, 'announcementId')),
        index('message_deliveries_subject_id_idx').on(col(table, 'subjectId')),
        uniqueIndex('message_deliveries_source_recipient_uidx').on(col(table, 'schoolId'), col(table, 'sourceKey'), col(table, 'subjectId'), col(table, 'recipientKind'), col(table, 'recipientId')),
      ]
    case 'subject_categories':
      return [
        index('subject_categories_school_id_idx').on(col(table, 'schoolId')),
        uniqueIndex('subject_categories_school_name_uidx').on(col(table, 'schoolId'), col(table, 'name')),
      ]
    case 'subjects':
      return [
        index('subjects_school_id_idx').on(col(table, 'schoolId')),
        index('subjects_category_id_idx').on(col(table, 'categoryId')),
      ]
    case 'subject_matters':
      return [index('subject_matters_subject_id_idx').on(col(table, 'subjectId'))]
    case 'class_groups':
      return [
        index('class_groups_school_id_idx').on(col(table, 'schoolId')),
        index('class_groups_academic_year_id_idx').on(col(table, 'academicYearId')),
        index('class_groups_grade_level_id_idx').on(col(table, 'gradeLevelId')),
      ]
    case 'class_subjects':
      return [
        index('class_subjects_class_group_id_idx').on(col(table, 'classGroupId')),
        index('class_subjects_subject_id_idx').on(col(table, 'subjectId')),
      ]
    case 'activities':
      return [index('activities_school_id_idx').on(col(table, 'schoolId'))]
    case 'activity_enrollments':
      return [
        index('activity_enrollments_activity_id_idx').on(col(table, 'activityId')),
        index('activity_enrollments_student_id_idx').on(col(table, 'studentId')),
      ]
    case 'class_activity_enrollments':
      return [
        index('class_activity_enrollments_activity_id_idx').on(col(table, 'activityId')),
        index('class_activity_enrollments_class_group_id_idx').on(col(table, 'classGroupId')),
      ]
    case 'class_subject_matters':
      return [index('class_subject_matters_class_subject_id_idx').on(col(table, 'classSubjectId'))]
    case 'assessments':
      return [
        index('assessments_class_group_id_idx').on(col(table, 'classGroupId')),
        index('assessments_class_subject_period_idx').on(col(table, 'classSubjectId'), col(table, 'periodId')),
        index('assessments_period_id_idx').on(col(table, 'periodId')),
      ]
    case 'assessment_results':
      return [
        index('assessment_results_student_id_idx').on(col(table, 'studentId')),
        index('assessment_results_assessment_id_idx').on(col(table, 'assessmentId')),
      ]
    case 'grade_scales':
      return [index('grade_scales_school_id_idx').on(col(table, 'schoolId'))]
    case 'report_card_definitions':
      return [
        index('report_card_definitions_school_id_idx').on(col(table, 'schoolId')),
        index('report_card_definitions_academic_year_id_idx').on(col(table, 'academicYearId')),
      ]
    case 'report_card_definition_sections':
      return [
        index('report_card_definition_sections_definition_id_idx').on(col(table, 'reportCardDefinitionId')),
        index('report_card_definition_sections_parent_section_id_idx').on(col(table, 'parentSectionId')),
      ]
    case 'report_card_results':
      return [
        index('report_card_results_student_id_idx').on(col(table, 'studentId')),
        index('report_card_results_definition_id_idx').on(col(table, 'reportCardDefinitionId')),
        index('report_card_results_class_group_period_idx').on(col(table, 'classGroupId'), col(table, 'periodId')),
      ]
    case 'students':
      return [
        index('students_school_id_idx').on(col(table, 'schoolId')),
        index('students_photo_attachment_id_idx').on(col(table, 'photoAttachmentId')),
        uniqueIndex('students_school_subject_uidx')
          .on(col(table, 'schoolId'), col(table, 'subjectId'))
          .where(sql`${col(table, 'subjectId')} is not null`),
      ]
    case 'student_photo_submissions':
      return [
        index('student_photo_submissions_school_id_idx').on(col(table, 'schoolId')),
        index('student_photo_submissions_student_id_idx').on(col(table, 'studentId')),
        index('student_photo_submissions_status_idx').on(col(table, 'schoolId'), col(table, 'status')),
        uniqueIndex('student_photo_submissions_one_pending_uidx')
          .on(col(table, 'schoolId'), col(table, 'studentId'))
          .where(sql`${col(table, 'status')} = 'pending'`),
      ]
    case 'student_class_enrollments':
      return [
        index('student_class_enrollments_student_id_idx').on(col(table, 'studentId')),
        index('student_class_enrollments_class_group_id_idx').on(col(table, 'classGroupId')),
        index('student_class_enrollments_academic_year_id_idx').on(col(table, 'academicYearId')),
        index('student_class_enrollments_student_status_idx').on(col(table, 'studentId'), col(table, 'status')),
        index('student_class_enrollments_class_group_status_idx').on(col(table, 'classGroupId'), col(table, 'status')),
        index('student_class_enrollments_student_class_group_idx').on(col(table, 'studentId'), col(table, 'classGroupId')),
      ]
    case 'guardians':
      return [
        index('guardians_school_id_idx').on(col(table, 'schoolId')),
        uniqueIndex('guardians_school_code_uidx').on(col(table, 'schoolId'), col(table, 'code')),
        uniqueIndex('guardians_school_subject_uidx')
          .on(col(table, 'schoolId'), col(table, 'subjectId'))
          .where(sql`${col(table, 'subjectId')} is not null`),
      ]
    case 'guardian_student_links':
      return [
        index('guardian_student_links_guardian_id_idx').on(col(table, 'guardianId')),
        index('guardian_student_links_student_id_idx').on(col(table, 'studentId')),
        index('guardian_student_links_school_id_idx').on(col(table, 'schoolId')),
      ]
    case 'student_notes':
      return [
        index('student_notes_student_id_idx').on(col(table, 'studentId')),
        index('student_notes_school_id_idx').on(col(table, 'schoolId')),
      ]
    case 'student_health_profiles':
      return [index('student_health_profiles_student_id_idx').on(col(table, 'studentId'))]
    case 'student_disciplinary_actions':
      return [
        index('student_disciplinary_actions_school_id_idx').on(col(table, 'schoolId')),
        index('student_disciplinary_actions_student_id_idx').on(col(table, 'studentId')),
        index('student_disciplinary_actions_incident_id_idx').on(col(table, 'incidentId')),
      ]
    case 'disciplinary_actions':
      return [index('disciplinary_actions_school_id_idx').on(col(table, 'schoolId'))]
    case 'student_incident_involvements':
      return [
        index('student_incident_involvements_student_id_idx').on(col(table, 'studentId')),
        index('student_incident_involvements_incident_id_idx').on(col(table, 'incidentId')),
      ]
    case 'incidents':
      return [
        index('incidents_school_id_idx').on(col(table, 'schoolId')),
        index('incidents_class_group_id_idx').on(col(table, 'classGroupId')),
      ]
    case 'cron_job_schedules':
      return [
        uniqueIndex('cron_job_schedules_job_key_idx').on(col(table, 'jobKey')),
        index('cron_job_schedules_due_idx').on(col(table, 'enabled'), col(table, 'nextRunAt')),
      ]
    case 'teacher_unavailabilities':
      return [
        index('teacher_unavailabilities_teacher_id_idx').on(col(table, 'teacherId')),
        index('teacher_unavailabilities_academic_year_id_idx').on(col(table, 'academicYearId')),
      ]
    case 'teachers':
      return [
        index('teachers_school_id_idx').on(col(table, 'schoolId')),
        uniqueIndex('teachers_school_code_uidx').on(col(table, 'schoolId'), col(table, 'code')),
        uniqueIndex('teachers_school_subject_uidx')
          .on(col(table, 'schoolId'), col(table, 'subjectId'))
          .where(sql`${col(table, 'subjectId')} is not null`),
      ]
    case 'platform_users':
      return [
        uniqueIndex('platform_users_subject_id_uidx').on(col(table, 'subjectId')),
        uniqueIndex('platform_users_email_uidx').on(col(table, 'email')),
      ]
    case 's2s_clients':
      return [
        uniqueIndex('s2s_clients_key_hash_uidx').on(col(table, 'keyHash')),
        index('s2s_clients_school_id_idx').on(col(table, 'schoolId')),
        index('s2s_clients_school_client_idx').on(col(table, 'schoolId'), col(table, 'clientId')),
      ]
    case 'account_invitations':
      return [
        index('account_invitations_contact_status_idx').on(
          col(table, 'contactChannel'),
          col(table, 'contactValue'),
          col(table, 'status'),
        ),
        uniqueIndex('account_invitations_token_hash_uidx').on(col(table, 'tokenHash')),
        uniqueIndex('account_invitations_pending_target_uidx')
          .on(col(table, 'schoolId'), col(table, 'kind'), col(table, 'targetId'))
          .where(sql`${col(table, 'status')} = 'pending'`),
      ]
    case 'document_issuances':
      return [
        index('document_issuances_school_id_idx').on(col(table, 'schoolId')),
        index('document_issuances_student_id_idx').on(col(table, 'studentId')),
        index('document_issuances_class_group_id_idx').on(col(table, 'classGroupId')),
        index('document_issuances_source_idx').on(col(table, 'schoolId'), col(table, 'templateKey'), col(table, 'sourceId')),
        index('document_issuances_status_idx').on(col(table, 'schoolId'), col(table, 'status')),
        uniqueIndex('document_issuances_request_uidx').on(
          col(table, 'schoolId'),
          col(table, 'templateKey'),
          col(table, 'sourceId'),
          col(table, 'requestId'),
        ),
      ]
    case 'document_number_series':
      return [
        index('document_number_series_school_id_idx').on(col(table, 'schoolId')),
        uniqueIndex('document_number_series_identity_uidx').on(
          col(table, 'schoolId'),
          col(table, 'documentKind'),
          col(table, 'academicYearId'),
        ),
      ]
    case 'family_feedback_campaigns':
      return [
        index('family_feedback_campaigns_school_id_idx').on(col(table, 'schoolId')),
        index('family_feedback_campaigns_status_idx').on(col(table, 'schoolId'), col(table, 'status')),
        index('family_feedback_campaigns_assignment_idx').on(
          col(table, 'schoolId'),
          col(table, 'teacherAssignmentId'),
          col(table, 'academicPeriodId'),
        ),
      ]
    case 'family_feedback_slots':
      return [
        uniqueIndex('family_feedback_slots_identity_uidx').on(
          col(table, 'schoolId'),
          col(table, 'campaignId'),
          col(table, 'studentId'),
          col(table, 'teacherAssignmentId'),
        ),
        index('family_feedback_slots_campaign_idx').on(col(table, 'schoolId'), col(table, 'campaignId'), col(table, 'status')),
        index('family_feedback_slots_student_idx').on(col(table, 'schoolId'), col(table, 'studentId')),
      ]
    case 'family_feedback_responses':
      return [
        uniqueIndex('family_feedback_responses_slot_uidx').on(col(table, 'schoolId'), col(table, 'slotId')),
        index('family_feedback_responses_campaign_idx').on(col(table, 'schoolId'), col(table, 'campaignId')),
      ]
    case 'family_feedback_snapshots':
      return [
        uniqueIndex('family_feedback_snapshots_campaign_uidx').on(col(table, 'schoolId'), col(table, 'campaignId')),
      ]
    case 'family_feedback_comment_read_audit':
      return [
        index('family_feedback_comment_read_audit_campaign_idx').on(col(table, 'schoolId'), col(table, 'campaignId')),
      ]
    default:
      return []
  }
}
