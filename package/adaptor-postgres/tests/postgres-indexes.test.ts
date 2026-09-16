import { afterEach, describe, expect, spyOn, test } from 'bun:test'
import * as pgCore from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../src/postgres-indexes'

function mockTable(columns: Record<string, string>) {
  return Object.fromEntries(Object.entries(columns).map(([key, name]) => [key, { name }]))
}

const INDEX_CASES: Array<{ tableName: string, columns: Record<string, string>, minIndexes: number }> = [
  { tableName: 'academic_years', columns: { schoolId: 'school_id', status: 'status' }, minIndexes: 2 },
  { tableName: 'academic_periods', columns: { schoolId: 'school_id', academicYearId: 'academic_year_id' }, minIndexes: 2 },
  { tableName: 'period_definitions', columns: { academicYearId: 'academic_year_id' }, minIndexes: 1 },
  { tableName: 'grade_levels', columns: { schoolId: 'school_id' }, minIndexes: 1 },
  { tableName: 'staff_members', columns: { schoolId: 'school_id', subjectId: 'subject_id', code: 'code' }, minIndexes: 3 },
  { tableName: 'service_api_keys', columns: { staffMemberId: 'staff_member_id' }, minIndexes: 1 },
  { tableName: 'platform_users', columns: { subjectId: 'subject_id', email: 'email' }, minIndexes: 2 },
  { tableName: 's2s_clients', columns: { keyHash: 'key_hash', schoolId: 'school_id', clientId: 'client_id' }, minIndexes: 3 },
  { tableName: 'account_invitations', columns: { contactChannel: 'contact_channel', contactValue: 'contact_value', status: 'status' }, minIndexes: 1 },
  { tableName: 'staff_assignments', columns: { staffId: 'staff_id', classGroupId: 'class_group_id' }, minIndexes: 2 },
  { tableName: 'staff_permission_assignments', columns: { staffId: 'staff_id', schoolId: 'school_id', academicYearId: 'academic_year_id' }, minIndexes: 3 },
  { tableName: 'attachments', columns: { schoolId: 'school_id', ownerKind: 'owner_kind', ownerId: 'owner_id' }, minIndexes: 2 },
  { tableName: 'resources', columns: { schoolId: 'school_id' }, minIndexes: 1 },
  { tableName: 'resource_assignments', columns: { resourceId: 'resource_id' }, minIndexes: 1 },
  { tableName: 'catalog_services', columns: { schoolId: 'school_id', academicYearId: 'academic_year_id', status: 'status' }, minIndexes: 3 },
  { tableName: 'student_service_enrollments', columns: { schoolId: 'school_id', studentId: 'student_id', catalogServiceId: 'catalog_service_id', academicYearId: 'academic_year_id', status: 'status' }, minIndexes: 4 },
  { tableName: 'student_charges', columns: { schoolId: 'school_id', studentId: 'student_id', enrollmentId: 'enrollment_id', academicYearId: 'academic_year_id', status: 'status' }, minIndexes: 5 },
  { tableName: 'student_year_accounts', columns: { schoolId: 'school_id', studentId: 'student_id', academicYearId: 'academic_year_id', currency: 'currency' }, minIndexes: 3 },
  { tableName: 'payments', columns: { schoolId: 'school_id', accountId: 'account_id', academicYearId: 'academic_year_id', reference: 'reference' }, minIndexes: 3 },
  { tableName: 'allocations', columns: { schoolId: 'school_id', accountId: 'account_id', chargeId: 'charge_id', kind: 'kind', reversesAllocationId: 'reverses_allocation_id' }, minIndexes: 4 },
  { tableName: 'student_account_entries', columns: { schoolId: 'school_id', accountId: 'account_id', recordedAt: 'recorded_at' }, minIndexes: 3 },
  { tableName: 'schedules', columns: { classGroupId: 'class_group_id', schoolId: 'school_id' }, minIndexes: 2 },
  { tableName: 'lesson_sessions', columns: { classGroupId: 'class_group_id', schoolId: 'school_id', scheduleId: 'schedule_id', calendarDate: 'calendar_date' }, minIndexes: 3 },
  { tableName: 'activity_sessions', columns: { classGroupId: 'class_group_id', schoolId: 'school_id', scheduleId: 'schedule_id', calendarDate: 'calendar_date' }, minIndexes: 3 },
  { tableName: 'attendances', columns: { classGroupId: 'class_group_id', schoolId: 'school_id' }, minIndexes: 2 },
  { tableName: 'calendar_events', columns: { schoolId: 'school_id', academicYearId: 'academic_year_id' }, minIndexes: 1 },
  { tableName: 'attendance_records', columns: { studentId: 'student_id', attendanceId: 'attendance_id', lessonSessionId: 'lesson_session_id' }, minIndexes: 3 },
  { tableName: 'announcements', columns: { schoolId: 'school_id' }, minIndexes: 1 },
  { tableName: 'announcement_targets', columns: { announcementId: 'announcement_id' }, minIndexes: 1 },
  { tableName: 'message_deliveries', columns: { schoolId: 'school_id', announcementId: 'announcement_id', subjectId: 'subject_id' }, minIndexes: 3 },
  { tableName: 'subjects', columns: { schoolId: 'school_id' }, minIndexes: 1 },
  { tableName: 'subject_matters', columns: { subjectId: 'subject_id' }, minIndexes: 1 },
  { tableName: 'class_groups', columns: { schoolId: 'school_id', academicYearId: 'academic_year_id', gradeLevelId: 'grade_level_id' }, minIndexes: 3 },
  { tableName: 'class_subjects', columns: { classGroupId: 'class_group_id', subjectId: 'subject_id' }, minIndexes: 2 },
  { tableName: 'activities', columns: { schoolId: 'school_id' }, minIndexes: 1 },
  { tableName: 'activity_enrollments', columns: { activityId: 'activity_id', studentId: 'student_id' }, minIndexes: 2 },
  { tableName: 'class_activity_enrollments', columns: { activityId: 'activity_id', classGroupId: 'class_group_id' }, minIndexes: 2 },
  { tableName: 'class_subject_matters', columns: { classSubjectId: 'class_subject_id' }, minIndexes: 1 },
  { tableName: 'assessments', columns: { classGroupId: 'class_group_id', classSubjectId: 'class_subject_id', periodId: 'period_id' }, minIndexes: 3 },
  { tableName: 'assessment_results', columns: { studentId: 'student_id', assessmentId: 'assessment_id' }, minIndexes: 2 },
  { tableName: 'grade_scales', columns: { schoolId: 'school_id' }, minIndexes: 1 },
  { tableName: 'report_card_definitions', columns: { schoolId: 'school_id', academicYearId: 'academic_year_id' }, minIndexes: 2 },
  { tableName: 'report_card_definition_sections', columns: { reportCardDefinitionId: 'definition_id', parentSectionId: 'parent_section_id' }, minIndexes: 2 },
  { tableName: 'report_card_results', columns: { studentId: 'student_id', reportCardDefinitionId: 'report_card_definition_id', classGroupId: 'class_group_id', periodId: 'period_id' }, minIndexes: 3 },
  { tableName: 'students', columns: { schoolId: 'school_id', photoAttachmentId: 'photo_attachment_id' }, minIndexes: 2 },
  { tableName: 'student_class_enrollments', columns: { studentId: 'student_id', classGroupId: 'class_group_id', academicYearId: 'academic_year_id', status: 'status' }, minIndexes: 6 },
  { tableName: 'guardians', columns: { schoolId: 'school_id', code: 'code' }, minIndexes: 2 },
  { tableName: 'guardian_student_links', columns: { guardianId: 'guardian_id', studentId: 'student_id', schoolId: 'school_id' }, minIndexes: 3 },
  { tableName: 'student_notes', columns: { studentId: 'student_id', schoolId: 'school_id' }, minIndexes: 2 },
  { tableName: 'student_photo_submissions', columns: { schoolId: 'school_id', studentId: 'student_id', status: 'status' }, minIndexes: 4 },
  { tableName: 'student_health_profiles', columns: { studentId: 'student_id' }, minIndexes: 1 },
  { tableName: 'student_disciplinary_actions', columns: { schoolId: 'school_id', studentId: 'student_id', incidentId: 'incident_id' }, minIndexes: 3 },
  { tableName: 'disciplinary_actions', columns: { schoolId: 'school_id' }, minIndexes: 1 },
  { tableName: 'student_incident_involvements', columns: { studentId: 'student_id', incidentId: 'incident_id' }, minIndexes: 2 },
  { tableName: 'incidents', columns: { schoolId: 'school_id', classGroupId: 'class_group_id' }, minIndexes: 2 },
  { tableName: 'document_issuances', columns: { schoolId: 'school_id', studentId: 'student_id', classGroupId: 'class_group_id', templateKey: 'template_key', sourceId: 'source_id', status: 'status', requestId: 'request_id' }, minIndexes: 6 },
  { tableName: 'document_number_series', columns: { schoolId: 'school_id', documentKind: 'document_kind', academicYearId: 'academic_year_id' }, minIndexes: 2 },
  { tableName: 'family_feedback_campaigns', columns: { schoolId: 'school_id', status: 'status', teacherAssignmentId: 'teacher_assignment_id', academicPeriodId: 'academic_period_id' }, minIndexes: 3 },
  { tableName: 'family_feedback_slots', columns: { schoolId: 'school_id', campaignId: 'campaign_id', studentId: 'student_id', teacherAssignmentId: 'teacher_assignment_id', status: 'status' }, minIndexes: 3 },
  { tableName: 'family_feedback_responses', columns: { schoolId: 'school_id', slotId: 'slot_id', campaignId: 'campaign_id' }, minIndexes: 2 },
  { tableName: 'family_feedback_snapshots', columns: { schoolId: 'school_id', campaignId: 'campaign_id' }, minIndexes: 1 },
  { tableName: 'family_feedback_comment_read_audit', columns: { schoolId: 'school_id', campaignId: 'campaign_id' }, minIndexes: 1 },
]

describe('definePerformanceIndexes', () => {
  function mockIndexBuilder(name?: string) {
    return {
      on: (...columns: unknown[]) => ({
        name,
        columns,
        where: (condition: unknown) => ({ name, columns, condition }),
      }),
    } as never
  }

  afterEach(() => {
    spyOn(pgCore, 'index').mockRestore()
    spyOn(pgCore, 'uniqueIndex').mockRestore()
  })

  for (const indexCase of INDEX_CASES) {
    test(`defines indexes for ${indexCase.tableName}`, () => {
      spyOn(pgCore, 'index').mockImplementation(mockIndexBuilder)
      spyOn(pgCore, 'uniqueIndex').mockImplementation(mockIndexBuilder)

      const indexes = definePerformanceIndexes(indexCase.tableName, mockTable(indexCase.columns) as never)
      expect(indexes.length).toBeGreaterThanOrEqual(indexCase.minIndexes)
    })
  }

  test('returns no indexes for tables outside the performance index map', () => {
    spyOn(pgCore, 'index').mockImplementation(mockIndexBuilder)
    spyOn(pgCore, 'uniqueIndex').mockImplementation(mockIndexBuilder)

    expect(definePerformanceIndexes('schools', mockTable({ id: 'id' }) as never)).toEqual([])
  })
})

await import('../src/postgres-schema')
