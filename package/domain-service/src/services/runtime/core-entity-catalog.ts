import type { EntityConfigFactory, EntityConfigFactoryInput } from '../entities/entity-config'
import type { ServiceArgs } from '../service-args'
import type { CoreEntityKey, CoreEntityMap } from './core-entity-map'
import { withNotificationPostSaveHook } from '../../capabilities/notifications/notification-trigger-registry'
import { NotificationTemplateService } from '../../capabilities/notifications/templates/notification-template-service'
import { academicPeriodConfig, academicYearConfig, accountInvitationConfig, activityConfig, activityEnrollmentConfig, activitySessionConfig, announcementConfig, announcementTargetConfig, assessmentConfig, assessmentResultConfig, attachmentConfig, attendanceConfig, attendanceRecordConfig, calendarEventConfig, catalogServiceConfig, classActivityEnrollmentConfig, classGroupConfig, classSubjectConfig, classSubjectMatterConfig, classSubjectProgressConfig, disciplinaryActionConfig, documentIssuanceConfig, gradeLevelConfig, gradeScaleConfig, guardianConfig, guardianStudentLinkConfig, incidentConfig, lessonSessionConfig, messageDeliveryConfig, paymentConfig, periodDefinitionConfig, reportCardResultConfig, reportModuleConfig, resourceAssignmentConfig, resourceConfig, scheduleConfig, schoolConfig, schoolNotificationTemplatesConfig, staffAssignmentConfig, staffManualPermissionAssignmentConfig, staffMemberConfig, staffPermissionAssignmentConfig, staffPermissionProfileBindingConfig, staffPermissionProfileConfig, staffPermissionScopeDefaultsConfig, studentChargeConfig, studentClassEnrollmentConfig, studentConfig, studentDisciplinaryActionConfig, studentHealthProfileConfig, studentIncidentInvolvementConfig, studentNoteConfig, studentPhotoSubmissionConfig, studentServiceEnrollmentConfig, studentYearAccountConfig, subjectCategoryConfig, subjectConfig, subjectMatterConfig, teacherAssignmentConfig, teacherConfig, teacherUnavailabilityConfig } from '../entities/config'
import { academicDisciplineConfig, placementStatusConfig, studentAcademicYearProfileConfig, teacherAcademicYearProfileConfig } from '../entities/config/school/intake-profiles'
import { studentSubjectEnrollmentConfig } from '../entities/config/students/student-subject-enrollment'
import { ManagedEntityService } from '../entities/managed-entity-service'
import { CORE_ENTITY_KEYS } from './core-entity-map'

export type CoreEntityConfigFactoryMap = {
  readonly [Key in CoreEntityKey]: EntityConfigFactory<CoreEntityMap[Key]>
}

export type CoreEntityServices = {
  readonly [Key in CoreEntityKey]: ManagedEntityService<CoreEntityMap[Key]>
}

export const CORE_ENTITY_CONFIG_FACTORIES: CoreEntityConfigFactoryMap = {
  academicDisciplines: academicDisciplineConfig,
  placementStatuses: placementStatusConfig,
  studentAcademicYearProfiles: studentAcademicYearProfileConfig,
  teacherAcademicYearProfiles: teacherAcademicYearProfileConfig,

  schools: schoolConfig,
  academicYears: academicYearConfig,
  academicPeriods: academicPeriodConfig,
  periodDefinitions: periodDefinitionConfig,
  gradeLevels: gradeLevelConfig,
  staffMembers: staffMemberConfig,
  staffAssignments: staffAssignmentConfig,
  teachers: teacherConfig,
  teacherAssignments: teacherAssignmentConfig,
  teacherUnavailabilities: teacherUnavailabilityConfig,
  accountInvitations: accountInvitationConfig,
  staffPermissionAssignments: staffPermissionAssignmentConfig,
  staffPermissionProfiles: staffPermissionProfileConfig,
  staffPermissionScopeDefaults: staffPermissionScopeDefaultsConfig,
  staffManualPermissionAssignments: staffManualPermissionAssignmentConfig,
  staffPermissionProfileBindings: staffPermissionProfileBindingConfig,
  attachments: attachmentConfig,
  resources: resourceConfig,
  resourceAssignments: resourceAssignmentConfig,
  catalogServices: catalogServiceConfig,
  studentServiceEnrollments: studentServiceEnrollmentConfig,
  studentCharges: studentChargeConfig,
  studentYearAccounts: studentYearAccountConfig,
  payments: paymentConfig,
  schedules: scheduleConfig,
  lessonSessions: lessonSessionConfig,
  activitySessions: activitySessionConfig,
  attendances: attendanceConfig,
  calendarEvents: calendarEventConfig,
  attendance: attendanceRecordConfig,
  announcements: announcementConfig,
  announcementTargets: announcementTargetConfig,
  messageDeliveries: messageDeliveryConfig,
  schoolNotificationTemplates: schoolNotificationTemplatesConfig,
  subjects: subjectConfig,
  subjectCategories: subjectCategoryConfig,
  subjectMatters: subjectMatterConfig,
  classGroups: classGroupConfig,
  classSubjects: classSubjectConfig,
  classSubjectMatters: classSubjectMatterConfig,
  classSubjectProgress: classSubjectProgressConfig,
  activities: activityConfig,
  activityEnrollments: activityEnrollmentConfig,
  classActivityEnrollments: classActivityEnrollmentConfig,
  assessments: assessmentConfig,
  assessmentResults: assessmentResultConfig,
  gradeScales: gradeScaleConfig,
  reportModules: reportModuleConfig,
  results: reportCardResultConfig,
  students: studentConfig,
  enrollments: studentClassEnrollmentConfig,
  subjectEnrollments: studentSubjectEnrollmentConfig,
  guardians: guardianConfig,
  guardianLinks: guardianStudentLinkConfig,
  studentNotes: studentNoteConfig,
  studentPhotoSubmissions: studentPhotoSubmissionConfig,
  studentHealthProfiles: studentHealthProfileConfig,
  studentDisciplinaryActions: studentDisciplinaryActionConfig,
  disciplinaryActions: disciplinaryActionConfig,
  studentIncidentInvolvements: studentIncidentInvolvementConfig,
  incidents: incidentConfig,
  documentIssuances: documentIssuanceConfig,
}

export function createCoreEntityServices(args: ServiceArgs): CoreEntityServices {
  const input: EntityConfigFactoryInput = {
    atomicExecution: args.atomicExecution,
    repositories: args.repositories,
    notificationGateway: args.notificationGateway,
    durableWork: args.durableWork,
    commandJournal: args.commandJournal,
  }
  const entries = CORE_ENTITY_KEYS.map(key => [
    key,
    createManagedEntityService(key, args, input),
  ] as const)

  return Object.fromEntries(entries) as CoreEntityServices
}

function createManagedEntityService<Key extends CoreEntityKey>(
  key: Key,
  args: ServiceArgs,
  input: EntityConfigFactoryInput,
): ManagedEntityService<CoreEntityMap[Key]> {
  const templateService = args.templateService ?? new NotificationTemplateService(args.repositories)
  const baseConfig = CORE_ENTITY_CONFIG_FACTORIES[key](input)
  if (['staffMembers', 'staffPermissionProfiles', 'staffPermissionAssignments', 'staffPermissionProfileBindings', 'staffManualPermissionAssignments', 'staffPermissionScopeDefaults'].includes(key))
    baseConfig.writeLockGroup = 'permission-state'
  if (['students', 'teachers', 'guardians', 'guardianLinks', 'subjects', 'subjectMatters', 'academicDisciplines', 'placementStatuses', 'studentAcademicYearProfiles', 'teacherAcademicYearProfiles', 'gradeLevels', 'academicYears', 'assessments', 'assessmentResults', 'results', 'enrollments', 'subjectEnrollments', 'classSubjects', 'classGroups', 'academicPeriods', 'reportModules', 'lessonSessions', 'attendance', 'classSubjectProgress', 'incidents', 'resourceAssignments', 'staffAssignments', 'teacherAssignments', 'teacherUnavailabilities', 'activitySessions', 'calendarEvents', 'periodDefinitions'].includes(key))
    baseConfig.writeLockGroup = 'academic-state'
  if (['catalogServices', 'studentServiceEnrollments', 'studentCharges', 'studentYearAccounts', 'payments'].includes(key))
    baseConfig.writeLockGroup = '0-finance-state'
  const config = withNotificationPostSaveHook(
    key,
    baseConfig,
    args.notificationGateway,
    templateService,
  )

  return new ManagedEntityService<CoreEntityMap[Key]>({
    actor: args.actor,
    repositories: args.repositories,
    config,
  })
}
