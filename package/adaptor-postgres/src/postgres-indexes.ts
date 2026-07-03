import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { index } from 'drizzle-orm/pg-core'

function col(table: Record<string, AnyPgColumn>, name: string): AnyPgColumn {
  return table[name]!
}

export function definePerformanceIndexes(tableName: string, table: Record<string, AnyPgColumn>) {
  switch (tableName) {
    case 'academic_years':
      return [
        index('academic_years_school_id_idx').on(col(table, 'schoolId')),
        index('academic_years_school_active_idx').on(col(table, 'schoolId'), col(table, 'isActive')),
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
    case 'fees':
      return [
        index('fees_school_id_idx').on(col(table, 'schoolId')),
        index('fees_academic_year_id_idx').on(col(table, 'academicYearId')),
      ]
    case 'student_fees':
      return [
        index('student_fees_student_id_idx').on(col(table, 'studentId')),
        index('student_fees_fee_id_idx').on(col(table, 'feeId')),
        index('student_fees_academic_year_id_idx').on(col(table, 'academicYearId')),
      ]
    case 'payments':
      return [index('payments_student_fee_id_idx').on(col(table, 'studentFeeId'))]
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
      ]
    case 'subjects':
      return [index('subjects_school_id_idx').on(col(table, 'schoolId'))]
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
        index('report_card_definition_sections_definition_id_idx').on(col(table, 'definitionId')),
        index('report_card_definition_sections_parent_section_id_idx').on(col(table, 'parentSectionId')),
      ]
    case 'report_card_results':
      return [
        index('report_card_results_student_id_idx').on(col(table, 'studentId')),
        index('report_card_results_definition_id_idx').on(col(table, 'reportCardDefinitionId')),
        index('report_card_results_class_group_period_idx').on(col(table, 'classGroupId'), col(table, 'periodId')),
      ]
    case 'students':
      return [index('students_school_id_idx').on(col(table, 'schoolId'))]
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
      return [index('guardians_school_id_idx').on(col(table, 'schoolId'))]
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
    default:
      return []
  }
}
