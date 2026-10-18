import type { AttendanceRecord, CoreEntityKey, CoreEntityMap, LessonSession, Payment, StudentCharge, StudentServiceEnrollment } from '@edaya/core'
import type { AccessPolicies, ActionSelection } from './access-policies'
import { assertCommentOnlyReportCardUpdate, AttendanceJustificationStatus, ChargeStatus, collectCommentChanges, OccurrenceStatus, PaymentStatus, Permission, ServiceEnrollmentStatus } from '@edaya/core'

import { assertActivityPlacements } from './activity-placements'
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
  classSubjectMatters: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.ACADEMIC_PROGRAM_MANAGE, delete: Permission.ACADEMIC_PROGRAM_MANAGE },
  classSubjectProgress: { read: [Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_MANAGE, Permission.GRADE_MANAGE], write: Permission.CLASS_LOGBOOK_MANAGE, delete: Permission.CLASS_LOGBOOK_MANAGE },
  classSubjects: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.ACADEMIC_PROGRAM_MANAGE, delete: Permission.ACADEMIC_PROGRAM_MANAGE },
  subjectMatters: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.ACADEMIC_PROGRAM_MANAGE, delete: Permission.ACADEMIC_PROGRAM_MANAGE },
  subjects: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.ACADEMIC_PROGRAM_MANAGE, delete: Permission.ACADEMIC_PROGRAM_MANAGE },
  subjectCategories: { read: [Permission.ACADEMIC_CATALOG_READ], write: Permission.ACADEMIC_CATALOG_MANAGE, delete: Permission.ACADEMIC_CATALOG_MANAGE },
  accountInvitations: { read: [Permission.ACCESS_CONTROL_MANAGE], write: [] },
  assessmentResults: { read: Permission.GRADE_READ, write: Permission.GRADE_MANAGE, delete: Permission.GRADE_MANAGE },
  assessments: { read: [Permission.ASSESSMENT_READ, Permission.GRADE_READ, Permission.CLASS_LOGBOOK_READ, Permission.GRADE_MANAGE, Permission.TIMETABLE_READ, Permission.ATTENDANCE_RECORD], write: Permission.ASSESSMENT_MANAGE, delete: Permission.ASSESSMENT_MANAGE },
  sections: { read: [Permission.REPORT_CARD_READ, Permission.GRADE_READ, Permission.REPORT_CARD_GENERATE, Permission.REPORT_CARD_CONFIGURE], write: Permission.REPORT_CARD_CONFIGURE },
  definitions: { read: [Permission.REPORT_CARD_READ, Permission.GRADE_READ, Permission.REPORT_CARD_GENERATE, Permission.REPORT_CARD_CONFIGURE], write: Permission.REPORT_CARD_CONFIGURE },
  results: { read: [Permission.REPORT_CARD_READ, Permission.GRADE_READ], write: reportWriteAction, delete: Permission.REPORT_CARD_GENERATE },
  catalogServices: { read: [Permission.FINANCIAL_CONFIG_READ, Permission.PAYMENT_READ], write: Permission.FINANCIAL_CATALOG_MANAGE, delete: Permission.FINANCIAL_CATALOG_MANAGE },
  studentServiceEnrollments: { read: [Permission.PAYMENT_READ, Permission.FINANCIAL_CONFIG_READ], write: studentEnrollmentWriteAction, delete: Permission.PAYMENT_CANCEL },
  studentCharges: { read: [Permission.PAYMENT_READ], write: studentChargeWriteAction, delete: Permission.PAYMENT_CANCEL },
  studentYearAccounts: { read: [Permission.PAYMENT_READ], write: [Permission.PAYMENT_RECORD, Permission.PAYMENT_ALLOCATE, Permission.PAYMENT_REVERSE] },
  payments: { read: [Permission.PAYMENT_READ], write: paymentWriteAction, delete: Permission.PAYMENT_CANCEL },
  announcementTargets: { read: [Permission.COMMUNICATION_READ, Permission.PERSONAL_COMMUNICATIONS_READ], write: Permission.COMMUNICATION_DRAFT_MANAGE, delete: Permission.COMMUNICATION_DRAFT_MANAGE },
  announcements: { read: [Permission.COMMUNICATION_READ, Permission.PERSONAL_COMMUNICATIONS_READ], write: (entity, existing) => existing && !existing.isPublished && entity.isPublished ? Permission.COMMUNICATION_SEND : existing ? Permission.COMMUNICATION_DRAFT_MANAGE : Permission.COMMUNICATION_DRAFT_MANAGE, delete: Permission.COMMUNICATION_DRAFT_MANAGE },
  messageDeliveries: { read: [Permission.COMMUNICATION_READ, Permission.PERSONAL_COMMUNICATIONS_READ], write: Permission.COMMUNICATION_DRAFT_MANAGE, delete: Permission.COMMUNICATION_DRAFT_MANAGE },
  schoolNotificationTemplates: { read: [Permission.SCHOOL_LIFECYCLE_MANAGE], write: [] },
  activitySessions: { read: [Permission.TIMETABLE_READ, Permission.ACTIVITY_MANAGE, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.ACTIVITY_MANAGE, delete: Permission.ACTIVITY_MANAGE },
  attendance: { read: [Permission.ATTENDANCE_READ, Permission.ATTENDANCE_RECORD, Permission.ATTENDANCE_MANAGE], write: attendanceWriteAction, delete: Permission.ATTENDANCE_MANAGE },
  attendances: { read: [Permission.ATTENDANCE_READ, Permission.ATTENDANCE_RECORD], write: Permission.ATTENDANCE_RECORD, delete: Permission.ATTENDANCE_MANAGE },
  calendarEvents: { read: [Permission.TIMETABLE_READ], write: Permission.SCHOOL_CONFIGURE },
  lessonSessions: { read: [Permission.TIMETABLE_READ, Permission.TIMETABLE_MANAGE, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_READ, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: resolveLessonSessionWriteAction, delete: Permission.TIMETABLE_MANAGE },
  periodDefinitions: { read: [Permission.WORKSPACE_ACCESS], write: [Permission.SCHOOL_CONFIGURE] },
  schedules: { read: [Permission.TIMETABLE_READ, Permission.TIMETABLE_MANAGE, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.TIMETABLE_MANAGE, delete: Permission.TIMETABLE_MANAGE },
  academicPeriods: { read: [Permission.WORKSPACE_ACCESS, Permission.SCHOOL_LIFECYCLE_MANAGE], write: academicPeriodWriteAction, delete: Permission.SCHOOL_CONFIGURE },
  academicYears: { read: [Permission.WORKSPACE_ACCESS, Permission.SCHOOL_LIFECYCLE_MANAGE], write: academicYearWriteAction, delete: Permission.SCHOOL_CONFIGURE },
  attachments: { read: [Permission.ATTACHMENT_READ], write: [Permission.ATTACHMENT_CONFIGURE] },
  classGroups: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_MANAGE, Permission.CLASS_READ, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE, Permission.GRADE_READ, Permission.CLASS_LOGBOOK_READ, Permission.ATTENDANCE_READ], write: [Permission.SCHOOL_CONFIGURE] },
  gradeLevels: { read: [Permission.ACADEMIC_PROGRAM_READ, Permission.ACADEMIC_PROGRAM_MANAGE, Permission.CLASS_READ, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE, Permission.GRADE_READ, Permission.CLASS_LOGBOOK_READ, Permission.ATTENDANCE_READ], write: [Permission.SCHOOL_CONFIGURE] },
  gradeScales: { read: [Permission.GRADE_READ, Permission.REPORT_CARD_CONFIGURE, Permission.GRADE_SCALE_CONFIGURE], write: [Permission.GRADE_SCALE_CONFIGURE] },
  resourceAssignments: { read: [Permission.RESOURCE_ASSIGNMENT_READ], write: [Permission.RESOURCE_ASSIGNMENT_MANAGE] },
  resources: { read: [Permission.RESOURCE_READ], write: [Permission.RESOURCE_CONFIGURE] },
  schools: { read: Permission.WORKSPACE_ACCESS, write: Permission.SCHOOL_CONFIGURE },
  staffAssignments: { read: [Permission.ACCESS_CONTROL_READ, Permission.WORKSPACE_ACCESS], write: Permission.ACCESS_CONTROL_MANAGE },
  staffMembers: { read: [Permission.STAFF_READ], write: Permission.STAFF_MANAGE, delete: Permission.STAFF_MANAGE },
  staffPermissionAssignments: { read: [Permission.ACCESS_CONTROL_READ], write: [], delete: [] },
  staffPermissionProfiles: { read: [Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_MANAGE, delete: Permission.ACCESS_CONTROL_MANAGE },
  staffPermissionScopeDefaults: { read: [Permission.ACCESS_CONTROL_READ], write: [] },
  staffManualPermissionAssignments: { read: [Permission.ACCESS_CONTROL_READ], write: [] },
  staffPermissionProfileBindings: { read: [Permission.ACCESS_CONTROL_READ], write: [] },
  teacherAssignments: { read: [Permission.STAFF_READ, Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_MANAGE },
  teacherUnavailabilities: { read: [Permission.STAFF_READ, Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_MANAGE },
  teachers: { read: [Permission.STAFF_READ, Permission.ACCESS_CONTROL_READ], write: Permission.ACCESS_CONTROL_MANAGE },
  activityEnrollments: { read: [Permission.ACTIVITY_READ, Permission.TIMETABLE_READ], write: Permission.ACTIVITY_ENROLLMENT_MANAGE, delete: Permission.ACTIVITY_ENROLLMENT_MANAGE },
  activities: { read: [Permission.ACTIVITY_READ], write: (_entity, existing) => existing ? Permission.ACTIVITY_MANAGE : Permission.ACTIVITY_CREATE, delete: Permission.ACTIVITY_MANAGE },
  classActivityEnrollments: { read: [Permission.ACTIVITY_READ, Permission.TIMETABLE_READ, Permission.ACTIVITY_MANAGE, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.ACTIVITY_MANAGE, delete: Permission.ACTIVITY_MANAGE },
  disciplinaryActions: { read: [Permission.DISCIPLINE_READ], write: [Permission.DISCIPLINE_VALIDATE] },
  guardianLinks: { read: [Permission.PARENT_READ, Permission.GUARDIAN_SELF_READ], write: Permission.PARENT_MANAGE, delete: Permission.PARENT_MANAGE },
  guardians: { read: [Permission.PARENT_READ, Permission.GUARDIAN_SELF_READ], write: (entity, existing) => !existing ? Permission.PARENT_MANAGE : existing.hasAccess && !entity.hasAccess ? Permission.PARENT_MANAGE : Permission.PARENT_MANAGE, delete: Permission.PARENT_MANAGE },
  incidents: { read: [Permission.DISCIPLINE_READ], write: incidentWriteAction, delete: Permission.DISCIPLINE_MANAGE },
  documentIssuances: {
    read: [Permission.STUDENT_READ, Permission.CLASS_READ, Permission.PAYMENT_READ, Permission.REPORT_CARD_READ, Permission.REPORT_CARD_EXPORT, Permission.CLASS_LOGBOOK_READ, Permission.DISCIPLINE_READ, Permission.ATTENDANCE_READ, Permission.TIMETABLE_READ, Permission.ENROLLMENT_READ, Permission.DOCUMENT_VOID],
    write: [],
  },
  enrollments: { read: [Permission.ENROLLMENT_READ, Permission.STUDENT_READ, Permission.GRADE_MANAGE, Permission.ATTENDANCE_RECORD, Permission.CLASS_LOGBOOK_MANAGE, Permission.DISCIPLINE_CREATE], write: Permission.ENROLLMENT_MANAGE, delete: Permission.ENROLLMENT_MANAGE },
  studentDisciplinaryActions: { read: [Permission.DISCIPLINE_READ], write: [Permission.DISCIPLINE_VALIDATE] },
  studentHealthProfiles: { read: [Permission.STUDENT_HEALTH_READ], write: [Permission.STUDENT_HEALTH_UPDATE] },
  studentIncidentInvolvements: { read: [Permission.DISCIPLINE_READ], write: (_entity, existing) => existing ? Permission.DISCIPLINE_MANAGE : Permission.DISCIPLINE_CREATE, delete: Permission.DISCIPLINE_MANAGE },
  studentNotes: { read: [Permission.STUDENT_NOTE_READ], write: [Permission.STUDENT_NOTE_MANAGE] },
  studentPhotoSubmissions: { read: [Permission.STUDENT_MANAGE, Permission.STUDENT_READ], write: [Permission.STUDENT_MANAGE, Permission.PARENT_MANAGE] },
  students: { read: [Permission.STUDENT_READ], write: (entity, existing) => !existing ? Permission.STUDENT_CREATE : existing.status !== entity.status && entity.status !== 'active' ? Permission.STUDENT_MANAGE : Permission.STUDENT_MANAGE, delete: Permission.STUDENT_MANAGE },
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

  async assertBatchSave(entities: CoreEntityMap[K][], existing: Map<string, CoreEntityMap[K]>) {
    if (this.resource !== 'assessmentResults') {
      const scopes = []
      for (const entity of entities) scopes.push(await this.assertSave(entity, existing.get(entity.id)))
      return scopes
    }
    const created = entities.filter(row => !existing.has(row.id)) as CoreEntityMap['assessmentResults'][]
    const updated = entities.filter(row => existing.has(row.id)) as CoreEntityMap['assessmentResults'][]
    const createScope = created.length ? await this.access.assertMarkBatch(Permission.GRADE_MANAGE, created, []) : undefined
    const updateScope = updated.length ? await this.access.assertMarkBatch(Permission.GRADE_MANAGE, updated, updated.map(row => existing.get(row.id) as CoreEntityMap['assessmentResults'])) : undefined
    return entities.map(row => (existing.has(row.id) ? updateScope : createScope)!)
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
    const scope = await this.access.assertResources(action, this.resource, ids, 'write', 'delete')
    if (this.resource === 'activities')
      await assertActivityPlacements(this.access, scope, ids)
    if (['subjects', 'subjectMatters'].includes(this.resource)) {
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
    return Permission.TIMETABLE_MANAGE
  }
  if (isLessonSessionLogbookOnlyUpdate(entity, existing)) {
    return Permission.CLASS_LOGBOOK_MANAGE
  }
  if (isLessonSessionAttendanceCompletionUpdate(entity, existing)) {
    return Permission.ATTENDANCE_RECORD
  }
  return Permission.TIMETABLE_MANAGE
}

function attendanceWriteAction(entity: AttendanceRecord, existing: AttendanceRecord | undefined): Permission {
  if (!existing)
    return Permission.ATTENDANCE_RECORD
  if (entity.studentId !== existing.studentId || entity.anchorKey !== existing.anchorKey
    || entity.date.getTime() !== existing.date.getTime() || entity.status !== existing.status) {
    return Permission.ATTENDANCE_MANAGE
  }
  if (entity.justificationStatus !== existing.justificationStatus || entity.reason !== existing.reason
    || entity.notes !== existing.notes || entity.justifiedAt?.getTime() !== existing.justifiedAt?.getTime()
    || entity.justifiedByStaffId !== existing.justifiedByStaffId) {
    return [AttendanceJustificationStatus.Excused, AttendanceJustificationStatus.Rejected].includes(entity.justificationStatus) ? Permission.ATTENDANCE_VALIDATE : Permission.ATTENDANCE_MANAGE
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
    : Permission.SCHOOL_CONFIGURE
}

function academicPeriodWriteAction(entity: CoreEntityMap['academicPeriods'], existing: CoreEntityMap['academicPeriods'] | undefined): Permission {
  return existing && entity.id === existing.id && entity.schoolId === existing.schoolId
    && entity.academicYearId === existing.academicYearId && entity.name === existing.name && entity.type === existing.type
    && entity.startDate.getTime() === existing.startDate.getTime() && entity.endDate.getTime() === existing.endDate.getTime()
    && entity.createdAt.getTime() === existing.createdAt.getTime()
    ? Permission.SCHOOL_LIFECYCLE_MANAGE
    : Permission.SCHOOL_CONFIGURE
}

function reportWriteAction(entity: CoreEntityMap['results'], existing?: CoreEntityMap['results']): ActionSelection {
  if (existing && collectCommentChanges(existing, entity).length) {
    assertCommentOnlyReportCardUpdate(existing, entity)
    return Permission.REPORT_CARD_COMMENT
  }
  return entity.status === 'published' || existing?.status === 'published' ? Permission.REPORT_CARD_PUBLISH : Permission.REPORT_CARD_GENERATE
}
