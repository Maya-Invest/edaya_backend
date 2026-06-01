import type {
  AcademicYear,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  AttendanceRecord,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  MessageDelivery,
  Payment,
  ReportCardDefinitionSection,
  ReportCardResult,
  ResourceAssignment,
  Schedule,
  School,
  Session,
  StaffAssignment,
  StudentClassEnrollment,
  StudentFee,
  StudentIncidentInvolvement,
  SubjectMatter,
} from '../../entities'
import type { BaseRepositoryInterface, SchoolRepositories } from '../../ports'
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { ServiceArgs } from '../shared/service-args'
import type { EntityReadAuthorization, EntityTenantResolver, EntityWriteAuthorization, ManagedEntityServiceConfig } from './managed-entity-service'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization'
import { BusinessRuleViolationError } from '../shared/business-rule-error'
import { directSchoolTenant, indirectTenant, schoolEntityTenant } from './tenant-resolvers'

type RepositoryEntity<R> = R extends BaseRepositoryInterface<infer T> ? T : never

export type SchoolEntityServiceConfigs = {
  [K in keyof SchoolRepositories]: ManagedEntityServiceConfig<RepositoryEntity<SchoolRepositories[K]>>
}

interface EntityWithId {
  id: string
}

interface EntityWithSchoolId extends EntityWithId {
  schoolId: string
}

export function createSchoolEntityServiceConfigs(args: ServiceArgs): SchoolEntityServiceConfigs {
  const { authorizationPolicy: policy, repositories, atomicExecution } = args

  const checkWorkspace = action(policy, 'queries.read_workspace')
  const checkClassDirectory = action(policy, 'queries.read_class_directory')
  const checkSetupManage = action(policy, 'setup.manage')
  const checkSetupAssignStaff = action(policy, 'setup.assign_staff')
  const checkAttachmentsRead = action(policy, 'attachments.read')
  const checkAttachmentsManage = action(policy, 'attachments.manage')
  const checkResourcesRead = action(policy, 'resources.read')
  const checkResourcesManage = action(policy, 'resources.manage')
  const checkFinanceRead = action(policy, 'finance.read')
  const checkFinanceManage = action(policy, 'finance.manage')
  const checkTimetableRead = action(policy, 'queries.read_timetable')
  const checkSchedulingManage = action(policy, 'scheduling.manage')
  const checkCalendarRead = action(policy, 'queries.read_calendar')
  const checkAttendanceRead = action(policy, 'attendance.read')
  const checkAttendanceRecord = action(policy, 'attendance.record')
  const checkCommunicationsRead = action(policy, 'queries.read_communications')
  const checkCommunicationsManage = action(policy, 'communications.manage')
  const checkCurriculumRead = action(policy, 'queries.read_class_curriculum')
  const checkCurriculumManage = action(policy, 'academics.manage_curriculum')
  const checkAcademicsReadProgress = action(policy, 'academics.read_progress')
  const checkAcademicsRecordProgress = action(policy, 'academics.record_progress')
  const checkAssessmentsReadResults = action(policy, 'assessments.read_results')
  const checkAssessmentsManageConfiguration = action(policy, 'assessments.manage_configuration')
  const checkAssessmentsRecordResult = action(policy, 'assessments.record_result')
  const checkReportCardReadDetail = action(policy, 'queries.read_report_card_detail')
  const checkReportCardPublish = action(policy, 'assessments.publish_report_card')
  const checkStudentDirectoryRead = action(policy, 'queries.read_student_directory')
  const checkEnrollmentHistoryRead = action(policy, 'queries.read_enrollment_history')
  const checkGuardianAdminRead = action(policy, 'queries.read_guardian_students_admin')
  const checkStudentDetailRead = action(policy, 'queries.read_student_detail')
  const checkStudentsManageProfile = action(policy, 'students.manage_profile')
  const checkStudentsManageEnrollment = action(policy, 'students.manage_enrollment')
  const checkStudentsManageGuardians = action(policy, 'students.manage_guardians')
  const checkStudentsManageHealth = action(policy, 'students.manage_health')
  const checkStudentsManageNotes = action(policy, 'students.manage_notes')
  const checkBehaviorReadIncidents = action(policy, 'behavior.read_incidents')
  const checkBehaviorReportIncident = action(policy, 'behavior.report_incident')
  const checkBehaviorManageDiscipline = action(policy, 'behavior.manage_discipline')

  return {
    schools: config<School>({
      repository: repositories.schools,
      tenant: schoolEntityTenant(),
      read: read(checkWorkspace, noopReadAccess),
      write: write(action(policy, 'setup.manage_lifecycle'), noopSaveAccess, noopDeleteAccess),
      atomicExecution,
    }),
    academicYears: config<AcademicYear>({
      repository: repositories.academicYears,
      tenant: directSchoolTenant(),
      read: read(checkWorkspace, noopReadAccess),
      write: write(checkSetupManage, noopSaveAccess, noopDeleteAccess),
      gates: {
        preDelete: async (year, repos) => {
          const classGroups = await repos.classGroups.list({ academicYearId: year.id })
          if (classGroups.length > 0) {
            throw new BusinessRuleViolationError(
              'ACADEMIC_YEAR_HAS_CLASS_GROUPS',
              `Cannot delete academic year ${year.id}: class groups still exist`,
            )
          }
        },
      },
      atomicExecution,
    }),
    academicPeriods: directConfig(repositories.academicPeriods, checkWorkspace, checkSetupManage),
    periodDefinitions: directConfig(repositories.periodDefinitions, checkWorkspace, checkSetupManage),
    gradeLevels: directConfig(repositories.gradeLevels, checkClassDirectory, checkSetupManage),
    staffMembers: directConfig(repositories.staffMembers, checkSetupManage, checkSetupManage),
    staffAssignments: config<StaffAssignment>({
      repository: repositories.staffAssignments,
      tenant: staffAssignmentTenant(),
      read: read(checkSetupManage, noopReadAccess),
      write: write(checkSetupAssignStaff, authorizeStaffAssignment(policy), authorizeStaffAssignmentDelete(policy)),
      atomicExecution,
    }),
    attachments: directConfig(repositories.attachments, checkAttachmentsRead, checkAttachmentsManage),
    resources: directConfig(repositories.resources, checkResourcesRead, checkResourcesManage),
    resourceAssignments: config<ResourceAssignment>({
      repository: repositories.resourceAssignments,
      tenant: resourceAssignmentTenant(),
      read: read(checkResourcesRead, noopReadAccess),
      write: write(checkResourcesManage, authorizeResourceAssignment(policy), authorizeResourceAssignmentDelete(policy)),
      atomicExecution,
    }),

    fees: directConfig(repositories.fees, checkFinanceRead, checkFinanceManage, readByIds((actor, ids) => policy.checkFeeAccess(actor, ids))),
    studentFees: config<StudentFee>({
      repository: repositories.studentFees,
      tenant: studentFeeTenant(),
      read: read(checkFinanceRead, readByIds((actor, ids) => policy.checkStudentFeeAccess(actor, ids))),
      write: write(checkFinanceManage, authorizeStudentFee(policy), authorizeStudentFeeDelete(policy)),
      atomicExecution,
    }),
    payments: config<Payment>({
      repository: repositories.payments,
      tenant: paymentTenant(),
      read: read(checkFinanceRead, noopReadAccess),
      write: write(checkFinanceManage, authorizePayment(policy), authorizePaymentDelete(policy)),
      atomicExecution,
    }),

    schedules: config<Schedule>({
      repository: repositories.schedules,
      tenant: classGroupLinkedTenant('classGroupId'),
      read: read(checkTimetableRead, noopReadAccess),
      write: write(checkSchedulingManage, authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
      atomicExecution,
    }),
    sessions: config<Session>({
      repository: repositories.sessions,
      tenant: classGroupLinkedTenant('classGroupId'),
      read: read(checkTimetableRead, readByIds((actor, ids) => policy.checkSessionAccess(actor, ids))),
      write: write(checkSchedulingManage, authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
      atomicExecution,
    }),
    calendarEvents: directConfig(repositories.calendarEvents, checkCalendarRead, checkSchedulingManage),
    attendance: config<AttendanceRecord>({
      repository: repositories.attendance,
      tenant: attendanceTenant(),
      read: read(checkAttendanceRead, async (actor, entities) => {
        await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
      }),
      write: write(checkAttendanceRecord, authorizeAttendance(policy), authorizeAttendanceDelete(policy)),
      atomicExecution,
    }),

    announcements: directConfig(repositories.announcements, checkCommunicationsRead, checkCommunicationsManage),
    announcementTargets: config<AnnouncementTarget>({
      repository: repositories.announcementTargets,
      tenant: announcementLinkedTenant('announcementId'),
      read: read(checkCommunicationsRead, noopReadAccess),
      write: write(checkCommunicationsManage, authorizeAnnouncementLinked(policy, 'announcementId'), authorizeAnnouncementLinkedDelete(policy)),
      atomicExecution,
    }),
    messageDeliveries: config<MessageDelivery>({
      repository: repositories.messageDeliveries,
      tenant: announcementLinkedTenant('announcementId'),
      read: read(checkCommunicationsRead, noopReadAccess),
      write: write(checkCommunicationsManage, authorizeAnnouncementLinked(policy, 'announcementId'), authorizeAnnouncementLinkedDelete(policy)),
      atomicExecution,
    }),

    subjects: directConfig(repositories.subjects, checkCurriculumRead, checkCurriculumManage),
    subjectMatters: config<SubjectMatter>({
      repository: repositories.subjectMatters,
      tenant: subjectMatterTenant(),
      read: read(checkCurriculumRead, noopReadAccess),
      write: write(checkCurriculumManage, authorizeSubjectMatter(policy), authorizeSubjectMatterDelete(policy)),
      atomicExecution,
    }),
    classGroups: directConfig(repositories.classGroups, checkClassDirectory, checkSetupManage, readByIds((actor, ids) => policy.checkClassGroupAccess(actor, ids))),
    classSubjects: config<ClassSubject>({
      repository: repositories.classSubjects,
      tenant: classGroupLinkedTenant('classGroupId'),
      read: read(checkCurriculumRead, noopReadAccess),
      write: write(checkCurriculumManage, authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
      atomicExecution,
    }),
    classSubjectMatters: config<ClassSubjectMatter>({
      repository: repositories.classSubjectMatters,
      tenant: classSubjectMatterTenant(),
      read: read(checkCurriculumRead, noopReadAccess),
      write: write(checkCurriculumManage, authorizeClassSubjectMatter(policy), authorizeClassSubjectMatterDelete(policy)),
      atomicExecution,
    }),
    classSubjectProgress: config<ClassSubjectProgress>({
      repository: repositories.classSubjectProgress,
      tenant: classSubjectProgressTenant(),
      read: read(checkAcademicsReadProgress, noopReadAccess),
      write: write(checkAcademicsRecordProgress, authorizeClassSubjectProgress(policy), authorizeClassSubjectProgressDelete(policy)),
      atomicExecution,
    }),

    assessments: config<Assessment>({
      repository: repositories.assessments,
      tenant: classGroupLinkedTenant('classGroupId'),
      read: read(checkAssessmentsReadResults, readByIds((actor, ids) => policy.checkAssessmentAccess(actor, ids))),
      write: write(checkAssessmentsManageConfiguration, authorizeClassGroupLinked(policy, 'classGroupId'), authorizeClassGroupLinkedDelete(policy)),
      atomicExecution,
    }),
    assessmentResults: config<AssessmentResult>({
      repository: repositories.assessmentResults,
      tenant: assessmentResultTenant(),
      read: read(checkAssessmentsReadResults, async (actor, entities, repos) => {
        const assessments = await repos.assessments.findByIds(unique(entities.map(entity => entity.assessmentId)))
        await policy.checkAssessmentAccess(actor, unique(assessments.map(assessment => assessment.id)))
      }),
      write: write(checkAssessmentsRecordResult, authorizeAssessmentResult(policy), authorizeAssessmentResultDelete(policy)),
      atomicExecution,
    }),
    gradeScales: directConfig(repositories.gradeScales, checkAssessmentsReadResults, checkAssessmentsManageConfiguration),
    definitions: directConfig(repositories.definitions, checkReportCardReadDetail, checkAssessmentsManageConfiguration),
    sections: config<ReportCardDefinitionSection>({
      repository: repositories.sections,
      tenant: reportCardSectionTenant(),
      read: read(checkReportCardReadDetail, noopReadAccess),
      write: write(checkAssessmentsManageConfiguration, authorizeReportCardSection(policy), authorizeReportCardSectionDelete(policy)),
      atomicExecution,
    }),
    results: config<ReportCardResult>({
      repository: repositories.results,
      tenant: reportCardResultTenant(),
      read: read(checkReportCardReadDetail, readByIds((actor, ids) => policy.checkReportCardResultAccess(actor, ids))),
      write: write(checkReportCardPublish, authorizeReportCardResult(policy), authorizeReportCardResultDelete(policy)),
      atomicExecution,
    }),

    students: directConfig(repositories.students, checkStudentDirectoryRead, checkStudentsManageProfile, readByIds((actor, ids) => policy.checkStudentAccess(actor, ids))),
    enrollments: config<StudentClassEnrollment>({
      repository: repositories.enrollments,
      tenant: studentLinkedTenant('studentId'),
      read: read(checkEnrollmentHistoryRead, async (actor, entities) => {
        await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
      }),
      write: write(checkStudentsManageEnrollment, authorizeStudentLinked(policy, 'studentId'), authorizeStudentLinkedDelete(policy)),
      atomicExecution,
    }),
    guardians: directConfig(repositories.guardians, checkGuardianAdminRead, checkStudentsManageGuardians, readByIds((actor, ids) => policy.checkGuardianAccess(actor, ids))),
    guardianLinks: directConfig(repositories.guardianLinks, checkGuardianAdminRead, checkStudentsManageGuardians, async (actor, entities) => {
      await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    }),
    studentNotes: directConfig(repositories.studentNotes, checkStudentDetailRead, checkStudentsManageNotes, readByIds((actor, ids) => policy.checkStudentNoteAccess(actor, ids))),
    studentHealthProfiles: directConfig(repositories.studentHealthProfiles, checkStudentDetailRead, checkStudentsManageHealth, readByIds((actor, ids) => policy.checkStudentHealthAccess(actor, ids))),
    studentDisciplinaryActions: directConfig(repositories.studentDisciplinaryActions, checkBehaviorReadIncidents, checkBehaviorManageDiscipline),
    disciplinaryActions: directConfig(repositories.disciplinaryActions, checkBehaviorReadIncidents, checkBehaviorManageDiscipline),
    studentIncidentInvolvements: config<StudentIncidentInvolvement>({
      repository: repositories.studentIncidentInvolvements,
      tenant: incidentLinkedTenant('incidentId'),
      read: read(checkBehaviorReadIncidents, noopReadAccess),
      write: write(checkBehaviorReportIncident, authorizeIncidentLinked(policy, 'incidentId'), authorizeIncidentLinkedDelete(policy)),
      atomicExecution,
    }),
    incidents: directConfig(repositories.incidents, checkBehaviorReadIncidents, checkBehaviorReportIncident),
  }

  function directConfig<T extends EntityWithSchoolId>(
    repository: BaseRepositoryInterface<T>,
    readModule: (actor: ActorMetadata) => Promise<void>,
    writeModule: (actor: ActorMetadata) => Promise<void>,
    readAccess: EntityReadAuthorization<T>['checkAccess'] = noopReadAccess,
  ): ManagedEntityServiceConfig<T> {
    return config({
      repository,
      tenant: directSchoolTenant<T>(),
      read: read(readModule, readAccess),
      write: write(writeModule, authorizeExistingById(readAccess), authorizeDeleteByReadAccess(readAccess)),
      atomicExecution,
    })
  }
}

function config<T>(input: ManagedEntityServiceConfig<T>): ManagedEntityServiceConfig<T> {
  return input
}

function action(policy: AuthorizationPolicy, actionName: string): (actor: ActorMetadata) => Promise<void> {
  return actor => policy.checkGlobalAction(actor, actionName)
}

function read<T>(
  checkModule: (actor: ActorMetadata) => Promise<void>,
  checkAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityReadAuthorization<T> {
  return { checkModule, checkAccess }
}

function write<T>(
  checkModule: (actor: ActorMetadata) => Promise<void>,
  authorizeSave: EntityWriteAuthorization<T>['authorizeSave'],
  authorizeDelete: EntityWriteAuthorization<T>['authorizeDelete'],
): EntityWriteAuthorization<T> {
  return { checkModule, authorizeSave, authorizeDelete }
}

async function noopReadAccess(): Promise<void> {}
async function noopSaveAccess(): Promise<void> {}
async function noopDeleteAccess(): Promise<void> {}

function readByIds<T extends EntityWithId>(
  checkIds: (actor: ActorMetadata, ids: readonly string[]) => Promise<void>,
): EntityReadAuthorization<T>['checkAccess'] {
  return async (actor, entities) => {
    await checkIds(actor, unique(entities.map(entity => entity.id)))
  }
}

function authorizeExistingById<T extends EntityWithId>(
  readAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    if (existing)
      await readAccess(actor, [existing], repositories)
    else if (entity.id)
      await noopReadAccess()
  }
}

function authorizeDeleteByReadAccess<T>(
  readAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    await readAccess(actor, [entity], repositories)
  }
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function classGroupLinkedTenant<T extends { classGroupId: string }>(field: keyof T): EntityTenantResolver<T> {
  return indirectTenant(async (entity, repositories) => {
    const classGroup = await repositories.classGroups.findById(entity[field] as string)
    return classGroup?.schoolId
  })
}

function studentLinkedTenant<T extends { studentId: string }>(field: keyof T): EntityTenantResolver<T> {
  return indirectTenant(async (entity, repositories) => {
    const student = await repositories.students.findById(entity[field] as string)
    return student?.schoolId
  })
}

function announcementLinkedTenant<T extends { announcementId: string }>(field: keyof T): EntityTenantResolver<T> {
  return indirectTenant(async (entity, repositories) => {
    const announcement = await repositories.announcements.findById(entity[field] as string)
    return announcement?.schoolId
  })
}

function incidentLinkedTenant<T extends { incidentId: string }>(field: keyof T): EntityTenantResolver<T> {
  return indirectTenant(async (entity, repositories) => {
    const incident = await repositories.incidents.findById(entity[field] as string)
    return incident?.schoolId
  })
}

function staffAssignmentTenant(): EntityTenantResolver<StaffAssignment> {
  return indirectTenant(async (entity, repositories) => {
    if (entity.classGroupId)
      return (await repositories.classGroups.findById(entity.classGroupId))?.schoolId
    if (entity.classSubjectId)
      return resolveClassSubjectSchoolId(repositories, entity.classSubjectId)
    if (entity.sessionId)
      return resolveSessionSchoolId(repositories, entity.sessionId)
    return undefined
  })
}

function resourceAssignmentTenant(): EntityTenantResolver<ResourceAssignment> {
  return indirectTenant(async (entity, repositories) => {
    const resource = await repositories.resources.findById(entity.resourceId)
    return resource?.schoolId
  })
}

function subjectMatterTenant(): EntityTenantResolver<SubjectMatter> {
  return indirectTenant(async (entity, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    return subject?.schoolId
  })
}

function classSubjectMatterTenant(): EntityTenantResolver<ClassSubjectMatter> {
  return indirectTenant(async (entity, repositories) => resolveClassSubjectSchoolId(repositories, entity.classSubjectId))
}

function classSubjectProgressTenant(): EntityTenantResolver<ClassSubjectProgress> {
  return indirectTenant(async (entity, repositories) => {
    const matter = await repositories.classSubjectMatters.findById(entity.classSubjectMatterId)
    return matter ? resolveClassSubjectSchoolId(repositories, matter.classSubjectId) : undefined
  })
}

function attendanceTenant(): EntityTenantResolver<AttendanceRecord> {
  return indirectTenant(async (entity, repositories) => resolveSessionSchoolId(repositories, entity.sessionId))
}

function studentFeeTenant(): EntityTenantResolver<StudentFee> {
  return indirectTenant(async (entity, repositories) => {
    const student = await repositories.students.findById(entity.studentId)
    return student?.schoolId
  })
}

function paymentTenant(): EntityTenantResolver<Payment> {
  return indirectTenant(async (entity, repositories) => {
    const studentFee = await repositories.studentFees.findById(entity.studentFeeId)
    if (!studentFee)
      return undefined
    const student = await repositories.students.findById(studentFee.studentId)
    return student?.schoolId
  })
}

function assessmentResultTenant(): EntityTenantResolver<AssessmentResult> {
  return indirectTenant(async (entity, repositories) => {
    const assessment = await repositories.assessments.findById(entity.assessmentId)
    if (!assessment)
      return undefined
    const classGroup = await repositories.classGroups.findById(assessment.classGroupId)
    return classGroup?.schoolId
  })
}

function reportCardSectionTenant(): EntityTenantResolver<ReportCardDefinitionSection> {
  return indirectTenant(async (entity, repositories) => {
    const definition = await repositories.definitions.findById(entity.reportCardDefinitionId)
    return definition?.schoolId
  })
}

function reportCardResultTenant(): EntityTenantResolver<ReportCardResult> {
  return indirectTenant(async (entity, repositories) => {
    const student = await repositories.students.findById(entity.studentId)
    return student?.schoolId
  })
}

async function resolveClassSubjectSchoolId(repositories: SchoolRepositories, classSubjectId: string): Promise<string | undefined> {
  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject)
    return undefined
  const classGroup = await repositories.classGroups.findById(classSubject.classGroupId)
  return classGroup?.schoolId
}

async function resolveSessionSchoolId(repositories: SchoolRepositories, sessionId: string): Promise<string | undefined> {
  const session = await repositories.sessions.findById(sessionId)
  if (!session)
    return undefined
  const classGroup = await repositories.classGroups.findById(session.classGroupId)
  return classGroup?.schoolId
}

function authorizeClassGroupLinked<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
  field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity[field] as string])
  }
}

function authorizeClassGroupLinkedDelete<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}

function authorizeStudentLinked<T extends { studentId: string }>(
  policy: AuthorizationPolicy,
  field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity[field] as string])
  }
}

function authorizeStudentLinkedDelete<T extends { studentId: string }>(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeAnnouncementLinked<T extends { announcementId: string }>(
  _policy: AuthorizationPolicy,
  _field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeAnnouncementLinkedDelete<T extends { announcementId: string }>(
  _policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return noopDeleteAccess
}

function authorizeIncidentLinked<T extends { incidentId: string }>(
  _policy: AuthorizationPolicy,
  _field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeIncidentLinkedDelete<T extends { incidentId: string }>(
  _policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return noopDeleteAccess
}

function authorizeStaffAssignment(policy: AuthorizationPolicy): EntityWriteAuthorization<StaffAssignment>['authorizeSave'] {
  return async (actor, entity, _existing, repositories) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.classSubjectId) {
      const classSubject = await repositories.classSubjects.findById(entity.classSubjectId)
      if (classSubject)
        await policy.checkClassGroupAccess(actor, [classSubject.classGroupId])
    }
    if (entity.sessionId)
      await policy.checkSessionAccess(actor, [entity.sessionId])
  }
}

function authorizeStaffAssignmentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StaffAssignment>['authorizeDelete'] {
  return async (actor, entity, repositories) => authorizeStaffAssignment(policy)(actor, entity, entity, repositories)
}

function authorizeResourceAssignment(policy: AuthorizationPolicy): EntityWriteAuthorization<ResourceAssignment>['authorizeSave'] {
  return async (actor, entity) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.sessionId)
      await policy.checkSessionAccess(actor, [entity.sessionId])
  }
}

function authorizeResourceAssignmentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<ResourceAssignment>['authorizeDelete'] {
  return async (actor, entity) => authorizeResourceAssignment(policy)(actor, entity, entity, {} as SchoolRepositories)
}

function authorizeStudentFee(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentFee>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeStudentFeeDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentFee>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentFeeAccess(actor, [entity.id])
  }
}

function authorizePayment(policy: AuthorizationPolicy): EntityWriteAuthorization<Payment>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkStudentFeeAccess(actor, [entity.studentFeeId])
  }
}

function authorizePaymentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<Payment>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentFeeAccess(actor, [entity.studentFeeId])
  }
}

function authorizeAttendance(policy: AuthorizationPolicy): EntityWriteAuthorization<AttendanceRecord>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkAttendanceAccess(actor, [entity.studentId], [entity.sessionId])
  }
}

function authorizeAttendanceDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<AttendanceRecord>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkAttendanceAccess(actor, [entity.studentId], [entity.sessionId])
  }
}

function authorizeSubjectMatter(_policy: AuthorizationPolicy): EntityWriteAuthorization<SubjectMatter>['authorizeSave'] {
  return async (actor, entity, _existing, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    if (!subject || subject.schoolId !== actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function authorizeSubjectMatterDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<SubjectMatter>['authorizeDelete'] {
  return noopDeleteAccess
}

function authorizeClassSubjectMatter(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectMatter>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeClassSubjectMatterDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectMatter>['authorizeDelete'] {
  return noopDeleteAccess
}

function authorizeClassSubjectProgress(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeClassSubjectProgressDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectProgress>['authorizeDelete'] {
  return noopDeleteAccess
}

function authorizeAssessmentResult(policy: AuthorizationPolicy): EntityWriteAuthorization<AssessmentResult>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkAssessmentAccess(actor, [entity.assessmentId])
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeAssessmentResultDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<AssessmentResult>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkAssessmentAccess(actor, [entity.assessmentId])
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeReportCardSection(_policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardDefinitionSection>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeReportCardSectionDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardDefinitionSection>['authorizeDelete'] {
  return noopDeleteAccess
}

function authorizeReportCardResult(policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardResult>['authorizeSave'] {
  return async (actor, entity, existing) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
    if (existing)
      await policy.checkReportCardResultAccess(actor, [existing.id])
  }
}

function authorizeReportCardResultDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardResult>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkReportCardResultAccess(actor, [entity.id])
  }
}
