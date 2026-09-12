import {
  AcademicsOperations,
  AccessControlOperations,
  ActorAssuranceLevel,
  AssessmentOperations,
  AttachmentOperations,
  AttendanceOperations,
  CommunicationsOperations,
  createPlatformActorMetadata,
  createS2sActorMetadata,
  DisciplineOperations,
  EnrollmentOperations,
  FinanceOperations,
  GradeOperations,
  GuardianOperations,
  LogbookOperations,
  Permission,
  PlatformOperations,
  PlatformUserOperations,
  QueryOperations,
  ReportCardOperations,
  ResourceOperations,
  S2sClientOperations,
  SchedulingOperations,
  SchoolStructureOperations,
  ServiceAccountOperations,
  StudentHealthOperations,
  StudentOperations,
  TeacherOperations,
  WorkspaceOperations,
} from '@edaya/authorization'
import { ALL_PLATFORM_PERMISSIONS } from '@edaya/core'
import { AuthFixtures } from '../../support/authorization-fixtures'
import { describeOperationMatrix } from '../../support/operation-matrix'
import {
  CLASS_GROUP,
  CLASS_SUBJECT,
  describeClassSubjectStaffTeacherMatrix,
  describeMatrix,
  describeStaffGlobalMatrices,
  STUDENT,
} from '../../support/operation-matrix-presets'

describeStaffGlobalMatrices([
  { operation: StudentOperations.update, permission: Permission.STUDENT_UPDATE },
  { operation: GuardianOperations.update, permission: Permission.PARENT_UPDATE },
  { operation: EnrollmentOperations.create, permission: Permission.ENROLLMENT_CREATE },
  { operation: StudentHealthOperations.read, permission: Permission.STUDENT_HEALTH_READ },
  { operation: StudentHealthOperations.update, permission: Permission.STUDENT_HEALTH_UPDATE },
  { operation: CommunicationsOperations.create, permission: Permission.COMMUNICATION_CREATE },
  { operation: AccessControlOperations.read, permission: Permission.ACCESS_CONTROL_READ },
  { operation: FinanceOperations.feeConfigure, permission: Permission.FINANCIAL_CONFIG_CONFIGURE },
  { operation: FinanceOperations.paymentRecord, permission: Permission.PAYMENT_RECORD },
  { operation: FinanceOperations.paymentCancel, permission: Permission.PAYMENT_CANCEL },
  { operation: FinanceOperations.paymentReverse, permission: Permission.PAYMENT_REVERSE },
  { operation: AttachmentOperations.configure, permission: Permission.ATTACHMENT_CONFIGURE },
  { operation: SchedulingOperations.calendarManage, permission: Permission.TIMETABLE_UPDATE },
  { operation: DisciplineOperations.validate, permission: Permission.DISCIPLINE_VALIDATE },
  { operation: AcademicsOperations.programUpdate, permission: Permission.ACADEMIC_PROGRAM_UPDATE },
  { operation: AcademicsOperations.examConfigure, permission: Permission.EXAM_CONFIG_CONFIGURE },
  { operation: QueryOperations.overdueFeesRead, permission: Permission.QUERY_OVERDUE_FEES_READ },
  { operation: ResourceOperations.read, permission: Permission.RESOURCE_READ },
  { operation: ResourceOperations.configure, permission: Permission.RESOURCE_CONFIGURE },
  { operation: PlatformOperations.registerSchool, permission: Permission.PLATFORM_REGISTER_SCHOOL },
  { operation: ServiceAccountOperations.read, permission: Permission.SERVICE_ACCOUNT_READ },
  { operation: ServiceAccountOperations.create, permission: Permission.SERVICE_ACCOUNT_CREATE },
  { operation: ServiceAccountOperations.update, permission: Permission.SERVICE_ACCOUNT_UPDATE },
  { operation: ServiceAccountOperations.revoke, permission: Permission.SERVICE_ACCOUNT_REVOKE },
  { operation: ServiceAccountOperations.rotateKey, permission: Permission.SERVICE_ACCOUNT_ROTATE_KEY },
  { operation: SchoolStructureOperations.staffRead, permission: Permission.QUERY_WORKSPACE_READ },
  { operation: SchedulingOperations.timetableManage, permission: Permission.TIMETABLE_UPDATE, context: { classGroupId: 'class-1' } },
  { operation: SchedulingOperations.timetableCreate, permission: Permission.TIMETABLE_CREATE, context: { classGroupId: 'class-1' } },
  { operation: SchedulingOperations.timetablePublish, permission: Permission.TIMETABLE_UPDATE, context: { classGroupId: 'class-1' } },
])

describeMatrix(WorkspaceOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_WORKSPACE_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny' },
  { label: 'guardian shell', actor: { kind: 'guardian' }, expect: 'allow' },
  { label: 'student shell', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(CommunicationsOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_COMMUNICATIONS_READ }, expect: 'allow' },
  { label: 'guardian', actor: { kind: 'guardian' }, expect: 'allow' },
  { label: 'student', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(AccessControlOperations.assign, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.ACCESS_CONTROL_ASSIGN }, expect: 'allow' },
  { label: 'teacher denied', actor: { kind: 'teacherSubject' }, expect: 'deny' },
  { label: 'guardian denied', actor: { kind: 'guardian' }, expect: 'deny' },
])

describeMatrix(StudentOperations.directoryRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_STUDENT_DIRECTORY_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'homeroom teacher', actor: { kind: 'teacherHomeroom' }, expect: 'allow' },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow' },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(GuardianOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ }, expect: 'allow' },
  { label: 'guardian self', actor: { kind: 'guardian' }, expect: 'allow' },
  { label: 'teacher denied', actor: { kind: 'teacherSubject' }, expect: 'deny' },
])

describeMatrix(EnrollmentOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.ENROLLMENT_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
])

describeMatrix(AcademicsOperations.programRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_CLASS_CURRICULUM_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny' },
  { label: 'guardian', actor: { kind: 'guardian' }, expect: 'allow' },
  { label: 'student', actor: { kind: 'student', classGroupId: 'cg-6a' }, expect: 'allow' },
])

describeMatrix(AcademicsOperations.curriculumReadScoped, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_CLASS_CURRICULUM_READ }, expect: 'allow' },
  { label: 'teacher with assignment', actor: { kind: 'teacherSubject' }, expect: 'allow', context: CLASS_SUBJECT },
])

describeMatrix(AcademicsOperations.curriculumRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_CLASS_CURRICULUM_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'guardian', actor: { kind: 'guardian' }, expect: 'allow' },
  { label: 'student', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(QueryOperations.overviewRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_OVERVIEW_READ }, expect: 'allow' },
  { label: 'teacher denied', actor: { kind: 'teacherSubject' }, expect: 'deny' },
])

describeMatrix(SchoolStructureOperations.configure, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.SCHOOL_STRUCTURE_CONFIGURE }, expect: 'allow' },
  { label: 'teacher denied', actor: { kind: 'teacherSubject' }, expect: 'deny' },
])

describeMatrix(SchoolStructureOperations.classGroupRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_CLASS_DIRECTORY_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny' },
  { label: 'guardian shell', actor: { kind: 'guardian' }, expect: 'allow' },
])

describeMatrix(SchoolStructureOperations.lifecycleManage, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.SCHOOL_LIFECYCLE_MANAGE }, expect: 'allow' },
  { label: 'teacher denied', actor: { kind: 'teacherSubject' }, expect: 'deny' },
])

describeMatrix(TeacherOperations.selfRead, [
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'unassigned teacher', actor: { kind: 'teacherUnassigned' }, expect: 'allow' },
  { label: 'guardian denied', actor: { kind: 'guardian' }, expect: 'deny' },
])

describeMatrix(TeacherOperations.assignmentRead, [
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'homeroom teacher', actor: { kind: 'teacherHomeroom' }, expect: 'allow' },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny' },
])

describeMatrix(GradeOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.GRADE_READ }, expect: 'allow' },
  { label: 'teacher subject scope', actor: { kind: 'teacherSubject' }, expect: 'allow', context: CLASS_SUBJECT },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny', context: CLASS_SUBJECT },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow', context: STUDENT },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(GradeOperations.input, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.GRADE_INPUT }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'guardian denied', actor: { kind: 'guardian' }, expect: 'deny' },
])

describeMatrix(AssessmentOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.GRADE_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow', context: CLASS_SUBJECT },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow', context: STUDENT },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
])

describeClassSubjectStaffTeacherMatrix(AssessmentOperations.create, Permission.GRADE_INPUT)
describeClassSubjectStaffTeacherMatrix(AssessmentOperations.update, Permission.GRADE_INPUT)
describeClassSubjectStaffTeacherMatrix(LogbookOperations.create, Permission.CLASS_LOGBOOK_CREATE)
describeClassSubjectStaffTeacherMatrix(LogbookOperations.update, Permission.CLASS_LOGBOOK_UPDATE)

describeMatrix(LogbookOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.CLASS_LOGBOOK_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow', context: CLASS_SUBJECT },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny', context: CLASS_SUBJECT },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow', context: STUDENT },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(DisciplineOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.DISCIPLINE_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny' },
])

describeMatrix(DisciplineOperations.create, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.DISCIPLINE_CREATE }, expect: 'allow', context: CLASS_SUBJECT },
  { label: 'teacher matching classSubject', actor: { kind: 'teacherSubject' }, expect: 'allow', context: CLASS_SUBJECT },
  { label: 'homeroom teacher', actor: { kind: 'teacherHomeroom' }, expect: 'allow', context: CLASS_GROUP },
])

describeMatrix(ReportCardOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_REPORT_CARD_DETAIL_READ }, expect: 'allow' },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow', context: STUDENT },
])

describeMatrix(ReportCardOperations.comment, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.REPORT_CARD_PUBLISH }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'guardian denied', actor: { kind: 'guardian' }, expect: 'deny' },
])

describeMatrix(FinanceOperations.feeCatalogRead, [
  { label: 'staff financial config', actor: { kind: 'staff', permission: Permission.FINANCIAL_CONFIG_READ }, expect: 'allow' },
  { label: 'staff payment read', actor: { kind: 'staff', permission: Permission.PAYMENT_READ }, expect: 'allow' },
  { label: 'guardian', actor: { kind: 'guardian' }, expect: 'allow' },
])

describeMatrix(FinanceOperations.paymentsRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.PAYMENT_READ }, expect: 'allow' },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow', context: STUDENT },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(AttachmentOperations.read, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.ATTACHMENT_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'guardian', actor: { kind: 'guardian' }, expect: 'allow' },
  { label: 'student', actor: { kind: 'student' }, expect: 'allow' },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny' },
])

describeMatrix(AttendanceOperations.read, [
  { label: 'staff attendance read', actor: { kind: 'staff', permission: Permission.ATTENDANCE_READ }, expect: 'allow' },
  { label: 'staff attendance justify', actor: { kind: 'staff', permission: Permission.ATTENDANCE_JUSTIFY }, expect: 'allow' },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow', context: STUDENT },
])

describeMatrix(AttendanceOperations.record, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.ATTENDANCE_RECORD }, expect: 'allow', context: CLASS_GROUP },
  { label: 'teacher classSubject', actor: { kind: 'teacherSubject' }, expect: 'allow', context: CLASS_SUBJECT },
  { label: 'homeroom teacher', actor: { kind: 'teacherHomeroom' }, expect: 'allow', context: CLASS_GROUP },
  { label: 'unassigned teacher denied', actor: { kind: 'teacherUnassigned' }, expect: 'deny' },
])

describeMatrix(SchedulingOperations.calendarRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_CALENDAR_READ }, expect: 'allow' },
  { label: 'guardian linked student', actor: { kind: 'guardian' }, expect: 'allow', context: STUDENT },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
])

describeMatrix(SchedulingOperations.timetableRead, [
  { label: 'staff', actor: { kind: 'staff', permission: Permission.QUERY_TIMETABLE_READ }, expect: 'allow' },
  { label: 'assigned teacher', actor: { kind: 'teacherSubject' }, expect: 'allow' },
  { label: 'student self', actor: { kind: 'student' }, expect: 'allow' },
])

const now = new Date('2026-09-01T00:00:00Z')

function platformOperator() {
  return createPlatformActorMetadata({
    subjectId: 'subject-op',
    actorId: 'platform-op',
    requestId: 'test',
    authenticatedAt: now,
    assuranceLevel: ActorAssuranceLevel.Verified,
    permissions: ALL_PLATFORM_PERMISSIONS,
    email: 'op@edaya.test',
  })
}

function s2sWrite() {
  return createS2sActorMetadata({
    actorId: 's2s-1',
    schoolId: 'school-1',
    requestId: 'test',
    clientId: 'children-ai',
    accessClass: 'write',
  })
}

for (const operation of [
  PlatformUserOperations.read,
  PlatformUserOperations.create,
  PlatformUserOperations.deactivate,
  S2sClientOperations.read,
  S2sClientOperations.create,
  S2sClientOperations.revoke,
  S2sClientOperations.rotateKey,
]) {
  describeOperationMatrix(operation, [
    { label: 'platform allowed', actor: platformOperator, expect: 'allow' },
    { label: 'staff denied', actor: () => AuthFixtures.staff.withPermissions([Permission.QUERY_WORKSPACE_READ]), expect: 'deny' },
    { label: 's2s write denied', actor: s2sWrite, expect: 'deny' },
  ])
}
