import type { EntityConfigFactory, EntityConfigFactoryInput } from '../entities/entity-config'
import type { ServiceArgs } from '../service-args'
import type { CoreEntityKey, CoreEntityMap } from './core-entity-map'
import { withNotificationPostSaveHook } from '../../capabilities/notifications/notification-trigger-registry'
import { NotificationTemplateService } from '../../capabilities/notifications/templates/notification-template-service'
import {
  academicPeriodConfig,
  academicYearConfig,
  accountInvitationConfig,
  activityConfig,
  activityEnrollmentConfig,
  activitySessionConfig,
  announcementConfig,
  announcementTargetConfig,
  assessmentConfig,
  assessmentResultConfig,
  attachmentConfig,
  attendanceConfig,
  attendanceRecordConfig,
  calendarEventConfig,
  classActivityEnrollmentConfig,
  classGroupConfig,
  classSubjectConfig,
  classSubjectMatterConfig,
  classSubjectProgressConfig,
  disciplinaryActionConfig,
  feeConfig,
  gradeLevelConfig,
  gradeLevelSubjectConfig,
  gradeLevelSubjectMatterConfig,
  gradeScaleConfig,
  guardianConfig,
  guardianStudentLinkConfig,
  incidentConfig,
  lessonSessionConfig,
  messageDeliveryConfig,
  paymentConfig,
  periodDefinitionConfig,
  reportCardDefinitionConfig,
  reportCardDefinitionSectionConfig,
  reportCardResultConfig,
  resourceAssignmentConfig,
  resourceConfig,
  scheduleConfig,
  schoolConfig,
  schoolNotificationTemplatesConfig,
  staffAssignmentConfig,
  staffMemberConfig,
  staffPermissionAssignmentConfig,
  studentClassEnrollmentConfig,
  studentConfig,
  studentDisciplinaryActionConfig,
  studentFeeConfig,
  studentHealthProfileConfig,
  studentIncidentInvolvementConfig,
  studentNoteConfig,
  subjectConfig,
  subjectMatterConfig,
  teacherAssignmentConfig,
  teacherConfig,
} from '../../domain'
import { ManagedEntityService } from '../entities/managed-entity-service'
import { CORE_ENTITY_KEYS } from './core-entity-map'

export type CoreEntityConfigFactoryMap = {
  readonly [Key in CoreEntityKey]: EntityConfigFactory<CoreEntityMap[Key]>
}

export type CoreEntityServices = {
  readonly [Key in CoreEntityKey]: ManagedEntityService<CoreEntityMap[Key]>
}

export const CORE_ENTITY_CONFIG_FACTORIES: CoreEntityConfigFactoryMap = {
  schools: schoolConfig,
  academicYears: academicYearConfig,
  academicPeriods: academicPeriodConfig,
  periodDefinitions: periodDefinitionConfig,
  gradeLevels: gradeLevelConfig,
  staffMembers: staffMemberConfig,
  staffAssignments: staffAssignmentConfig,
  teachers: teacherConfig,
  teacherAssignments: teacherAssignmentConfig,
  accountInvitations: accountInvitationConfig,
  staffPermissionAssignments: staffPermissionAssignmentConfig,
  attachments: attachmentConfig,
  resources: resourceConfig,
  resourceAssignments: resourceAssignmentConfig,
  fees: feeConfig,
  studentFees: studentFeeConfig,
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
  subjectMatters: subjectMatterConfig,
  gradeLevelSubjects: gradeLevelSubjectConfig,
  gradeLevelSubjectMatters: gradeLevelSubjectMatterConfig,
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
  definitions: reportCardDefinitionConfig,
  sections: reportCardDefinitionSectionConfig,
  results: reportCardResultConfig,
  students: studentConfig,
  enrollments: studentClassEnrollmentConfig,
  guardians: guardianConfig,
  guardianLinks: guardianStudentLinkConfig,
  studentNotes: studentNoteConfig,
  studentHealthProfiles: studentHealthProfileConfig,
  studentDisciplinaryActions: studentDisciplinaryActionConfig,
  disciplinaryActions: disciplinaryActionConfig,
  studentIncidentInvolvements: studentIncidentInvolvementConfig,
  incidents: incidentConfig,
}

export function createCoreEntityServices(args: ServiceArgs): CoreEntityServices {
  const input: EntityConfigFactoryInput = {
    policy: args.authorizationPolicy,
    atomicExecution: args.atomicExecution,
    repositories: args.repositories,
    notificationGateway: args.notificationGateway,
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
  const config = withNotificationPostSaveHook(
    key,
    CORE_ENTITY_CONFIG_FACTORIES[key](input),
    args.notificationGateway,
    templateService,
  )

  return new ManagedEntityService<CoreEntityMap[Key]>({
    actor: args.actor,
    repositories: args.repositories,
    config,
  })
}
