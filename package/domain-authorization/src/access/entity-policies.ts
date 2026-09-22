import type { AttendanceRecord, CoreEntityKey, CoreEntityMap, LessonSession, Payment, StudentCharge, StudentServiceEnrollment } from '@edaya/core'
import type { AccessPolicies, ActionSelection } from './access-policies'
import { AttendanceJustificationStatus, ChargeStatus, OccurrenceStatus, PaymentStatus, Permission, ServiceEnrollmentStatus } from '@edaya/core'

import { assertCurriculumPlacements } from './curriculum-placements'
import { denied } from './facts'
import { incidentWriteAction } from './incident-changes'

interface EntityRule<K extends CoreEntityKey> {
  read: ActionSelection
  write: ActionSelection | ((entity: CoreEntityMap[K], existing: CoreEntityMap[K] | undefined) => ActionSelection)
  delete?: ActionSelection
}

/** Complete business actions for persisted entities. A module-entry permission never substitutes for these actions. */
const entityRules: { [K in CoreEntityKey]: EntityRule<K> } = {
  classSubjectMatters: { read: [Permission.QUERY_CLASS_CURRICULUM_READ, Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE, Permission.QUERY_CURRICULUM_PROGRESS_READ], write: (_entity, existing) => existing ? Permission.ACADEMIC_PROGRAM_UPDATE : Permission.ACADEMIC_PROGRAM_ASSIGN, delete: Permission.ACADEMIC_PROGRAM_DELETE },
  classSubjectProgress: { read: [Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.GRADE_INPUT], write: (_entity, existing) => existing ? Permission.CLASS_LOGBOOK_UPDATE : Permission.CLASS_LOGBOOK_CREATE, delete: Permission.CLASS_LOGBOOK_UPDATE },
  classSubjects: { read: [Permission.QUERY_CLASS_CURRICULUM_READ, Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: (_entity, existing) => existing ? Permission.ACADEMIC_PROGRAM_UPDATE : Permission.ACADEMIC_PROGRAM_ASSIGN, delete: Permission.ACADEMIC_PROGRAM_DELETE },
  gradeLevelSubjectMatters: { read: [Permission.QUERY_CLASS_CURRICULUM_READ], write: (_entity, existing) => existing ? Permission.ACADEMIC_PROGRAM_UPDATE : Permission.ACADEMIC_PROGRAM_CREATE, delete: Permission.ACADEMIC_PROGRAM_DELETE },
  gradeLevelSubjects: { read: [Permission.QUERY_CLASS_CURRICULUM_READ], write: (_entity, existing) => existing ? Permission.ACADEMIC_PROGRAM_UPDATE : Permission.ACADEMIC_PROGRAM_CREATE, delete: Permission.ACADEMIC_PROGRAM_DELETE },
  subjectMatters: { read: [Permission.QUERY_CLASS_CURRICULUM_READ, Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE, Permission.QUERY_CURRICULUM_PROGRESS_READ], write: (_entity, existing) => existing ? Permission.ACADEMIC_PROGRAM_UPDATE : Permission.ACADEMIC_PROGRAM_CREATE, delete: Permission.ACADEMIC_PROGRAM_DELETE },
  subjects: { read: [Permission.QUERY_CLASS_CURRICULUM_READ, Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: (_entity, existing) => existing ? Permission.ACADEMIC_PROGRAM_UPDATE : Permission.ACADEMIC_PROGRAM_CREATE, delete: Permission.ACADEMIC_PROGRAM_DELETE },
  subjectCategories: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.QUERY_CLASS_CURRICULUM_READ], write: Permission.ACADEMIC_PROGRAM_UPDATE, delete: Permission.ACADEMIC_PROGRAM_UPDATE },
  accountInvitations: { read: [Permission.ACCESS_CONTROL_ASSIGN], write: [] },
  assessmentResults: { read: Permission.GRADE_READ, write: (_entity, existing) => existing ? Permission.GRADE_UPDATE : Permission.GRADE_INPUT, delete: Permission.GRADE_UPDATE },
  assessments: { read: [Permission.EXAM_CONFIG_READ, Permission.GRADE_READ, Permission.QUERY_CURRICULUM_PROGRESS_READ, Permission.GRADE_INPUT, Permission.GRADE_UPDATE, Permission.QUERY_TIMETABLE_READ, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ], write: (_entity, existing) => existing ? Permission.EXAM_CONFIG_UPDATE : Permission.EXAM_CONFIG_CREATE, delete: Permission.EXAM_CONFIG_CONFIGURE },
  sections: { read: [Permission.REPORT_CARD_READ, Permission.QUERY_REPORT_CARD_DETAIL_READ, Permission.GRADE_READ, Permission.REPORT_CARD_GENERATE, Permission.REPORT_CARD_CONFIGURE], write: Permission.REPORT_CARD_CONFIGURE },
  definitions: { read: [Permission.REPORT_CARD_READ, Permission.QUERY_REPORT_CARD_DETAIL_READ, Permission.GRADE_READ, Permission.REPORT_CARD_GENERATE, Permission.REPORT_CARD_CONFIGURE], write: Permission.REPORT_CARD_CONFIGURE },
  results: { read: [Permission.REPORT_CARD_READ, Permission.QUERY_REPORT_CARD_DETAIL_READ, Permission.GRADE_READ], write: (entity, existing) => entity.status === 'published' || existing?.status === 'published' ? Permission.REPORT_CARD_PUBLISH : [Permission.REPORT_CARD_GENERATE, Permission.REPORT_CARD_PUBLISH], delete: Permission.REPORT_CARD_CONFIGURE },
  catalogServices: { read: [Permission.FINANCIAL_CONFIG_READ, Permission.PAYMENT_READ], write: (_entity, existing) => existing ? Permission.FINANCIAL_CONFIG_UPDATE : Permission.FINANCIAL_CONFIG_CONFIGURE, delete: Permission.FINANCIAL_CONFIG_CONFIGURE },
  studentServiceEnrollments: { read: [Permission.PAYMENT_READ, Permission.FINANCIAL_CONFIG_READ], write: studentEnrollmentWriteAction, delete: Permission.PAYMENT_CANCEL },
  studentCharges: { read: [Permission.PAYMENT_READ], write: studentChargeWriteAction, delete: Permission.PAYMENT_CANCEL },
  studentYearAccounts: { read: [Permission.PAYMENT_READ], write: [Permission.PAYMENT_RECORD, Permission.PAYMENT_ALLOCATE, Permission.PAYMENT_REVERSE] },
  payments: { read: [Permission.PAYMENT_READ], write: paymentWriteAction, delete: Permission.PAYMENT_CANCEL },
  announcementTargets: { read: [Permission.COMMUNICATION_READ, Permission.QUERY_COMMUNICATIONS_READ], write: (_entity, existing) => existing ? Permission.COMMUNICATION_UPDATE : Permission.COMMUNICATION_CREATE, delete: Permission.COMMUNICATION_DELETE },
  announcements: { read: [Permission.COMMUNICATION_READ, Permission.QUERY_COMMUNICATIONS_READ], write: (entity, existing) => existing && !existing.isPublished && entity.isPublished ? Permission.COMMUNICATION_SEND : existing ? Permission.COMMUNICATION_UPDATE : Permission.COMMUNICATION_CREATE, delete: Permission.COMMUNICATION_DELETE },
  messageDeliveries: { read: [Permission.COMMUNICATION_READ, Permission.QUERY_COMMUNICATIONS_READ], write: (_entity, existing) => existing ? Permission.COMMUNICATION_UPDATE : Permission.COMMUNICATION_CREATE, delete: Permission.COMMUNICATION_DELETE },
  schoolNotificationTemplates: { read: [Permission.SCHOOL_LIFECYCLE_MANAGE], write: [] },
  activitySessions: { read: [Permission.QUERY_TIMETABLE_READ, Permission.TIMETABLE_UPDATE, Permission.TIMETABLE_CREATE, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: (_entity, existing) => existing ? Permission.TIMETABLE_UPDATE : Permission.TIMETABLE_CREATE, delete: Permission.TIMETABLE_UPDATE },
  attendance: { read: [Permission.ATTENDANCE_READ, Permission.ATTENDANCE_RECORD, Permission.ATTENDANCE_UPDATE, Permission.ATTENDANCE_JUSTIFY], write: attendanceWriteAction, delete: Permission.ATTENDANCE_UPDATE },
  attendances: { read: [Permission.ATTENDANCE_READ, Permission.QUERY_ATTENDANCE_READ, Permission.ATTENDANCE_RECORD], write: Permission.ATTENDANCE_RECORD, delete: Permission.ATTENDANCE_UPDATE },
  calendarEvents: { read: [Permission.QUERY_CALENDAR_READ], write: (_entity, existing) => existing ? Permission.TIMETABLE_UPDATE : Permission.TIMETABLE_CREATE, delete: Permission.TIMETABLE_UPDATE },
  lessonSessions: { read: [Permission.QUERY_TIMETABLE_READ, Permission.TIMETABLE_UPDATE, Permission.TIMETABLE_CREATE, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: resolveLessonSessionWriteAction, delete: Permission.TIMETABLE_UPDATE },
  periodDefinitions: { read: [Permission.QUERY_WORKSPACE_READ], write: [Permission.SCHOOL_STRUCTURE_CONFIGURE] },
  schedules: { read: [Permission.QUERY_TIMETABLE_READ, Permission.TIMETABLE_UPDATE, Permission.TIMETABLE_CREATE, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: (_entity, existing) => existing ? Permission.TIMETABLE_UPDATE : Permission.TIMETABLE_CREATE, delete: Permission.TIMETABLE_UPDATE },
  academicPeriods: { read: [Permission.QUERY_WORKSPACE_READ, Permission.SCHOOL_LIFECYCLE_MANAGE], write: academicPeriodWriteAction, delete: Permission.SCHOOL_STRUCTURE_CONFIGURE },
  academicYears: { read: [Permission.QUERY_WORKSPACE_READ, Permission.SCHOOL_LIFECYCLE_MANAGE], write: academicYearWriteAction, delete: Permission.SCHOOL_STRUCTURE_CONFIGURE },
  attachments: { read: [Permission.ATTACHMENT_READ], write: [Permission.ATTACHMENT_CONFIGURE] },
  classGroups: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_UPDATE, Permission.QUERY_CLASS_DIRECTORY_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE, Permission.GRADE_READ, Permission.CLASS_LOGBOOK_READ, Permission.ATTENDANCE_READ], write: [Permission.SCHOOL_STRUCTURE_CONFIGURE] },
  gradeLevels: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_UPDATE, Permission.QUERY_CLASS_DIRECTORY_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE, Permission.GRADE_READ, Permission.CLASS_LOGBOOK_READ, Permission.ATTENDANCE_READ], write: [Permission.SCHOOL_STRUCTURE_CONFIGURE] },
  gradeScales: { read: [Permission.GRADE_READ], write: [Permission.EXAM_CONFIG_CONFIGURE] },
  resourceAssignments: { read: [Permission.RESOURCE_READ], write: [Permission.RESOURCE_CONFIGURE] },
  resources: { read: [Permission.RESOURCE_READ], write: [Permission.RESOURCE_CONFIGURE] },
  schools: { read: Permission.QUERY_WORKSPACE_READ, write: Permission.SCHOOL_LIFECYCLE_MANAGE },
  staffAssignments: { read: [Permission.ACCESS_CONTROL_READ, Permission.QUERY_WORKSPACE_READ], write: Permission.ACCESS_CONTROL_ASSIGN },
  staffMembers: { read: [Permission.STAFF_READ], write: (entity, existing) => !existing ? Permission.STAFF_CREATE : existing.isActive && !entity.isActive ? Permission.STAFF_ARCHIVE : Permission.STAFF_UPDATE, delete: Permission.STAFF_ARCHIVE },
  staffPermissionAssignments: { read: [Permission.ACCESS_CONTROL_READ], write: [Permission.ACCESS_CONTROL_ASSIGN] },
  staffPermissionProfiles: { read: [Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_CONFIGURE, delete: Permission.ACCESS_CONTROL_CONFIGURE },
  staffPermissionProfileBindings: { read: [Permission.ACCESS_CONTROL_READ], write: [] },
  teacherAssignments: { read: [Permission.STAFF_READ, Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_ASSIGN },
  teacherUnavailabilities: { read: [Permission.STAFF_READ, Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_ASSIGN },
  teachers: { read: [Permission.STAFF_READ, Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_ASSIGN },
  activityEnrollments: { read: [Permission.ENROLLMENT_READ, Permission.QUERY_ENROLLMENT_HISTORY_READ, Permission.TIMETABLE_READ, Permission.QUERY_TIMETABLE_READ], write: (_entity, existing) => existing ? Permission.ENROLLMENT_UPDATE : Permission.ENROLLMENT_CREATE, delete: Permission.ENROLLMENT_ARCHIVE },
  activities: { read: [Permission.RESOURCE_READ, Permission.TIMETABLE_READ, Permission.QUERY_TIMETABLE_READ], write: Permission.RESOURCE_CONFIGURE },
  classActivityEnrollments: { read: [Permission.QUERY_TIMETABLE_READ, Permission.TIMETABLE_UPDATE, Permission.TIMETABLE_CREATE, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: (_entity, existing) => existing ? Permission.TIMETABLE_UPDATE : Permission.TIMETABLE_CREATE, delete: Permission.TIMETABLE_UPDATE },
  disciplinaryActions: { read: [Permission.DISCIPLINE_READ], write: [Permission.DISCIPLINE_VALIDATE] },
  guardianLinks: { read: [Permission.PARENT_READ, Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ, Permission.QUERY_GUARDIAN_SELF_READ], write: Permission.PARENT_UPDATE, delete: Permission.PARENT_UPDATE },
  guardians: { read: [Permission.PARENT_READ, Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ, Permission.QUERY_GUARDIAN_SELF_READ], write: (entity, existing) => !existing ? Permission.PARENT_CREATE : existing.hasAccess && !entity.hasAccess ? Permission.PARENT_ARCHIVE : Permission.PARENT_UPDATE, delete: Permission.PARENT_ARCHIVE },
  incidents: { read: [Permission.DISCIPLINE_READ], write: incidentWriteAction, delete: Permission.DISCIPLINE_ARCHIVE },
  documentIssuances: {
    read: [Permission.QUERY_STUDENT_DETAIL_READ, Permission.QUERY_CLASS_DIRECTORY_READ, Permission.PAYMENT_READ, Permission.REPORT_CARD_READ, Permission.CLASS_LOGBOOK_READ, Permission.DISCIPLINE_READ, Permission.ATTENDANCE_READ, Permission.QUERY_TIMETABLE_READ, Permission.ENROLLMENT_READ, Permission.QUERY_ENROLLMENT_HISTORY_READ, Permission.DOCUMENT_VOID],
    write: [],
  },
  enrollments: { read: [Permission.QUERY_ENROLLMENT_HISTORY_READ, Permission.ENROLLMENT_READ, Permission.STUDENT_READ, Permission.GRADE_INPUT, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_CREATE, Permission.CLASS_LOGBOOK_UPDATE, Permission.DISCIPLINE_CREATE], write: (_entity, existing) => existing ? Permission.ENROLLMENT_UPDATE : Permission.ENROLLMENT_CREATE, delete: Permission.ENROLLMENT_ARCHIVE },
  studentDisciplinaryActions: { read: [Permission.DISCIPLINE_READ], write: [Permission.DISCIPLINE_VALIDATE] },
  studentHealthProfiles: { read: [Permission.STUDENT_HEALTH_READ], write: [Permission.STUDENT_HEALTH_UPDATE] },
  studentIncidentInvolvements: { read: [Permission.DISCIPLINE_READ], write: (_entity, existing) => existing ? Permission.DISCIPLINE_UPDATE : Permission.DISCIPLINE_CREATE, delete: Permission.DISCIPLINE_ARCHIVE },
  studentNotes: { read: [Permission.QUERY_STUDENT_DIRECTORY_READ, Permission.QUERY_STUDENT_DETAIL_READ], write: [Permission.CLASS_LOGBOOK_UPDATE] },
  studentPhotoSubmissions: { read: [Permission.STUDENT_UPDATE, Permission.QUERY_STUDENT_DETAIL_READ], write: [Permission.STUDENT_UPDATE, Permission.PARENT_UPDATE] },
  students: { read: [Permission.STUDENT_READ, Permission.QUERY_STUDENT_DIRECTORY_READ, Permission.QUERY_STUDENT_DETAIL_READ], write: (entity, existing) => !existing ? Permission.STUDENT_CREATE : existing.status !== entity.status && entity.status !== 'active' ? Permission.STUDENT_ARCHIVE : Permission.STUDENT_UPDATE, delete: Permission.STUDENT_ARCHIVE },
}

/** Binds business actions internally before applying the shared grant/relationship predicates. */
export class EntityAccessPolicy<K extends CoreEntityKey> {
  private readonly rule: EntityRule<K>
  constructor(private readonly access: AccessPolicies, private readonly resource: K) {
    this.rule = entityRules[resource]
  }

  readScope() {
    return this.access.scope(this.rule.read, this.resource)
  }

  async assertSave(entity: CoreEntityMap[K], existing?: CoreEntityMap[K]) {
    if (this.resource === 'teachers' && this.access.actor.kind === 'teacher') {
      return this.access.assertTeacherSelfProfile(
        entity as CoreEntityMap['teachers'],
        existing as CoreEntityMap['teachers'] | undefined,
      )
    }
    const action = typeof this.rule.write === 'function' ? this.rule.write(entity, existing) : this.rule.write
    if (this.resource === 'payments' && action !== Permission.PAYMENT_RECORD) {
      const after = entity as Payment
      const before = existing as Payment | undefined
      if (!before || paymentDetails(after) !== paymentDetails(before))
        await this.access.assertSave(Permission.PAYMENT_RECORD, this.resource, entity, existing)
    }
    if (this.resource === 'studentCharges' && action === Permission.PAYMENT_CANCEL) {
      const after = entity as StudentCharge
      const before = existing as StudentCharge | undefined
      if (!before || studentChargeDetails(after) !== studentChargeDetails(before))
        await this.access.assertSave(Permission.PAYMENT_RECORD, this.resource, entity, existing)
    }
    return this.access.assertSave(action, this.resource, entity, existing)
  }

  async assertDelete(ids: readonly string[]) {
    const actor = this.access.actor
    if (actor.kind === 'guardian' && (this.resource === 'guardians' || this.resource === 'guardianLinks'))
      denied('Guardians cannot delete profiles or relationships')
    if (actor.kind === 'staff' && this.resource === 'staffMembers' && ids.includes(actor.staffMemberId))
      denied('Staff members cannot delete their own account')
    const action = this.rule.delete ?? (typeof this.rule.write === 'function' ? [] : this.rule.write)
    const scope = await this.access.assertResources(action, this.resource, ids)
    if (['subjects', 'subjectMatters', 'gradeLevelSubjects', 'gradeLevelSubjectMatters'].includes(this.resource)) {
      const records = await this.access.repositories[this.resource].forAccess(scope).findByIds([...ids])
      await assertCurriculumPlacements(this.access, action, this.resource, records)
    }
    if (this.resource === 'staffMembers') {
      const staff = await this.access.repositories.staffMembers.forAccess(scope).findByIds([...ids])
      if (staff.some(member => member.accountKind === 'service'))
        denied('Service accounts must be managed through service-account commands')
    }
    if (this.resource === 'staffPermissionAssignments' || this.resource === 'staffAssignments') {
      const resource = this.resource as 'staffPermissionAssignments' | 'staffAssignments'
      const assignments = await this.access.repositories[resource].forAccess(scope).findByIds([...ids])
      for (const assignment of assignments)
        await this.access.assertStaffAdministrationTarget(assignment.staffId)
    }
    return scope
  }
}

function paymentDetails(payment: Payment): string {
  const { status: _status, reversedAt: _reversedAt, reversedById: _reversedById, reversedByPaymentId: _reversedByPaymentId, ...details } = payment.data
  return JSON.stringify(details)
}

function studentChargeDetails(charge: StudentCharge): string {
  const { status: _status, cancellationReason: _reason, cancelledAt: _cancelledAt, cancelledById: _cancelledById, ...details } = charge.data
  return JSON.stringify(details)
}

function isLessonSessionLogbookOnlyUpdate(
  entity: LessonSession,
  existing: LessonSession,
): boolean {
  return entity.schoolId === existing.schoolId
    && entity.classGroupId === existing.classGroupId
    && entity.scheduleId === existing.scheduleId
    && entity.timetableGenerated === existing.timetableGenerated
    && entity.timetableTeacherIds.join('|') === existing.timetableTeacherIds.join('|')
    && entity.classSubjectId === existing.classSubjectId
    && entity.status === existing.status
    && entity.isException === existing.isException
    && entity.startsAt.getTime() === existing.startsAt.getTime()
    && entity.endsAt.getTime() === existing.endsAt.getTime()
    && entity.createdAt.getTime() === existing.createdAt.getTime()
}

function isLessonSessionAttendanceCompletionUpdate(
  entity: LessonSession,
  existing: LessonSession,
): boolean {
  return entity.schoolId === existing.schoolId
    && entity.classGroupId === existing.classGroupId
    && entity.scheduleId === existing.scheduleId
    && entity.timetableGenerated === existing.timetableGenerated
    && entity.timetableTeacherIds.join('|') === existing.timetableTeacherIds.join('|')
    && entity.classSubjectId === existing.classSubjectId
    && entity.isException === existing.isException
    && entity.startsAt.getTime() === existing.startsAt.getTime()
    && entity.endsAt.getTime() === existing.endsAt.getTime()
    && entity.displayLabel === existing.displayLabel
    && entity.sessionNote === existing.sessionNote
    && entity.createdAt.getTime() === existing.createdAt.getTime()
    && existing.status === OccurrenceStatus.Pending
    && entity.status === OccurrenceStatus.Completed
}

function resolveLessonSessionWriteAction(
  entity: LessonSession,
  existing: LessonSession | undefined,
) {
  if (!existing) {
    return Permission.TIMETABLE_CREATE
  }
  if (isLessonSessionLogbookOnlyUpdate(entity, existing)) {
    return Permission.CLASS_LOGBOOK_UPDATE
  }
  if (isLessonSessionAttendanceCompletionUpdate(entity, existing)) {
    return Permission.ATTENDANCE_RECORD
  }
  return Permission.TIMETABLE_UPDATE
}

function attendanceWriteAction(entity: AttendanceRecord, existing: AttendanceRecord | undefined): Permission {
  if (!existing)
    return Permission.ATTENDANCE_RECORD
  if (entity.studentId !== existing.studentId || entity.anchorKey !== existing.anchorKey
    || entity.date.getTime() !== existing.date.getTime() || entity.status !== existing.status) {
    return Permission.ATTENDANCE_UPDATE
  }
  if (entity.justificationStatus !== existing.justificationStatus || entity.reason !== existing.reason
    || entity.notes !== existing.notes || entity.justifiedAt?.getTime() !== existing.justifiedAt?.getTime()
    || entity.justifiedByStaffId !== existing.justifiedByStaffId) {
    return [AttendanceJustificationStatus.Excused, AttendanceJustificationStatus.Rejected].includes(entity.justificationStatus) ? Permission.ATTENDANCE_VALIDATE : Permission.ATTENDANCE_JUSTIFY
  }
  return Permission.ATTENDANCE_RECORD
}

function paymentWriteAction(
  entity: Payment,
  existing: Payment | undefined,
): ActionSelection {
  if (entity.status === PaymentStatus.Reversed && existing?.status !== PaymentStatus.Reversed) {
    return Permission.PAYMENT_REVERSE
  }
  return Permission.PAYMENT_RECORD
}

function studentChargeWriteAction(
  entity: StudentCharge,
  existing: StudentCharge | undefined,
): ActionSelection {
  if (existing?.status !== ChargeStatus.Cancelled && entity.status === ChargeStatus.Cancelled) {
    return Permission.PAYMENT_CANCEL
  }
  return Permission.PAYMENT_RECORD
}

function studentEnrollmentWriteAction(
  entity: StudentServiceEnrollment,
  existing: StudentServiceEnrollment | undefined,
): ActionSelection {
  if (existing?.status !== ServiceEnrollmentStatus.Cancelled && entity.status === ServiceEnrollmentStatus.Cancelled) {
    return Permission.PAYMENT_CANCEL
  }
  return Permission.PAYMENT_RECORD
}

function academicYearWriteAction(entity: CoreEntityMap['academicYears'], existing: CoreEntityMap['academicYears'] | undefined): Permission {
  return existing && entity.id === existing.id && entity.schoolId === existing.schoolId
    && entity.name === existing.name && entity.startDate.getTime() === existing.startDate.getTime()
    && entity.endDate.getTime() === existing.endDate.getTime() && entity.createdAt.getTime() === existing.createdAt.getTime()
    ? Permission.SCHOOL_LIFECYCLE_MANAGE
    : Permission.SCHOOL_STRUCTURE_CONFIGURE
}

function academicPeriodWriteAction(entity: CoreEntityMap['academicPeriods'], existing: CoreEntityMap['academicPeriods'] | undefined): Permission {
  return existing && entity.id === existing.id && entity.schoolId === existing.schoolId
    && entity.academicYearId === existing.academicYearId && entity.name === existing.name && entity.type === existing.type
    && entity.startDate.getTime() === existing.startDate.getTime() && entity.endDate.getTime() === existing.endDate.getTime()
    && entity.createdAt.getTime() === existing.createdAt.getTime()
    ? Permission.SCHOOL_LIFECYCLE_MANAGE
    : Permission.SCHOOL_STRUCTURE_CONFIGURE
}
