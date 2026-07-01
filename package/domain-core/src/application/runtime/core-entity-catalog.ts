import type { CoreEntityKey, CoreEntityMap } from '../core-entity-map'
import type { EntityConfigFactory, EntityConfigFactoryInput } from '../shared'
import type { ServiceArgs } from '../shared/service-args'
import { CORE_ENTITY_KEYS } from '../core-entity-map'
import {
  academicPeriodConfig,
  academicYearConfig,
  accessRoleConfig,
  accountInvitationConfig,
  activityEnrollmentConfig,
  announcementConfig,
  announcementTargetConfig,
  assessmentConfig,
  assessmentResultConfig,
  attachmentConfig,
  attendanceRecordConfig,
  calendarEventConfig,
  classGroupConfig,
  classLogbookEntryConfig,
  classSubjectConfig,
  classSubjectMatterConfig,
  classSubjectProgressConfig,
  disciplinaryActionConfig,
  extracurricularActivityConfig,
  feeConfig,
  gradeLevelConfig,
  gradeLevelSubjectConfig,
  gradeLevelSubjectMatterConfig,
  gradeScaleConfig,
  guardianConfig,
  guardianStudentLinkConfig,
  homeworkAssignmentConfig,
  homeworkSubmissionConfig,
  incidentConfig,
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
  sessionConfig,
  staffAssignmentConfig,
  staffMemberConfig,
  staffRoleAssignmentConfig,
  studentClassEnrollmentConfig,
  studentConfig,
  studentDisciplinaryActionConfig,
  studentFeeConfig,
  studentHealthProfileConfig,
  studentIncidentInvolvementConfig,
  studentNoteConfig,
  subjectConfig,
  subjectMatterConfig,
} from '../domains'
import { withNotificationPostSaveHook } from '../notifications/notification-trigger-registry'
import { NotificationTemplateService } from '../notifications/templates/notification-template-service'
import { ManagedEntityService } from './managed-entity-service'

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
  accessRoles: accessRoleConfig,
  accountInvitations: accountInvitationConfig,
  staffRoleAssignments: staffRoleAssignmentConfig,
  attachments: attachmentConfig,
  resources: resourceConfig,
  resourceAssignments: resourceAssignmentConfig,
  fees: feeConfig,
  studentFees: studentFeeConfig,
  payments: paymentConfig,
  schedules: scheduleConfig,
  sessions: sessionConfig,
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
  classLogbookEntries: classLogbookEntryConfig,
  homeworkAssignments: homeworkAssignmentConfig,
  homeworkSubmissions: homeworkSubmissionConfig,
  activities: extracurricularActivityConfig,
  activityEnrollments: activityEnrollmentConfig,
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
