import type { StaffPermissionAssignmentInput } from '../../domain'
import type { SchoolCommandKey } from '../runtime/school-command-catalog'
import type {
  AcademicsServiceWorkflow,
  AddCustomClassSubjectInput,
  AssignMatterToClassSubjectInput,
  AssignMatterToGradeLevelSubjectInput,
  ConfigureSubjectInput,
  ConfigureSubjectMatterInput,
  OfferSubjectToClassInput,
  OfferSubjectToGradeLevelInput,
  RecordLessonSessionProgressInput,
  RemoveSubjectFromGradeLevelInput,
  SetClassSubjectOfferedInput,
  UpdateGradeLevelSubjectInput,
} from '../workflows/academics'
import type { AccessControlServiceWorkflow, LinkActorSubjectInput } from '../workflows/access-control'
import type {
  AcceptAccountInvitationInput,
  AccountInvitationServiceWorkflow,
  ResendAccountInvitationInput,
  RevokeAccountInvitationInput,
  SendAccountInvitationInput,
} from '../workflows/account-invitation'
import type {
  AssessmentsServiceWorkflow,
  CompleteAssessmentInput,
  CreateAssessmentInput,
  CreateGradeScaleInput,
  CreateReportCardDefinitionInput,
  CreateReportCardDefinitionSectionInput,
  GenerateReportCardResultInput,
  ListClassSubjectAssessmentResultsForPeriodInput,
  PublishReportCardResultInput,
  RecordAssessmentResultInput,
} from '../workflows/assessments'
import type {
  AddStudentInvolvementInput,
  ApplyDisciplinaryActionInput,
  BehaviorServiceWorkflow,
  ConfigureDisciplinaryActionInput,
  RecordIncidentInput,
  ResolveIncidentInput,
  ResolveIncidentWithOutcomesInput,
  UpdateStudentDisciplinaryActionStatusInput,
} from '../workflows/behavior'
import type {
  AddAnnouncementTargetInput,
  ApplyDeliveryEventInput,
  CommunicationsServiceWorkflow,
  CreateAnnouncementInput,
  MarkDeliveryReadInput,
  MaterializeDeliveriesInput,
  PublishAnnouncementInput,
  RecordDeliveryInput,
  RegisterPushDeviceInput,
  UnregisterPushDeviceInput,
  UpdateNotificationContactInput,
} from '../workflows/communications'
import type {
  AdjustStudentFeeInput,
  AssignFeeToStudentInput,
  CancelStudentFeeInput,
  CreateFeeInput,
  FinanceServiceWorkflow,
  RecordPaymentInput,
  UpdatePaymentStatusInput,
} from '../workflows/finance'
import type {
  NotificationTemplatesServiceWorkflow,
  ResetSchoolNotificationTemplatesInput,
  UpdateSchoolNotificationTemplatesInput,
} from '../workflows/notification-templates'
import type {
  CancelActivitySessionInput,
  CancelLessonSessionInput,
  CreateCalendarEventInput,
  CreateScheduleInput,
  MaterializeScheduleInput,
  RecordAttendanceInput,
  RecordClassDailyAttendanceInput,
  RecordDailyAttendanceInput,
  RecordLessonSessionAttendanceInput,
  RequestAttendanceJustificationInput,
  RescheduleOccurrenceInput,
  ReviewAttendanceJustificationInput,
  SaveScheduleInput,
  SchedulingServiceWorkflow,
} from '../workflows/scheduling'
import type {
  ActivateAcademicYearInput,
  AssignResourceInput,
  AssignStaffInput,
  ConfigureActivityInput,
  ConfigureGradeLevelInput,
  ConfigurePeriodDefinitionInput,
  ConfigureResourceInput,
  CreateAcademicPeriodInput,
  CreateAcademicYearInput,
  CreateClassGroupInput,
  EnrollStudentInActivityInput,
  PublishAcademicPeriodInput,
  RegisterAttachmentInput,
  RegisterSchoolInput,
  RegisterStaffMemberInput,
  RemoveAttachmentInput,
  RemoveResourceAssignmentInput,
  SetupServiceWorkflow,
  UpdateClassGroupConfigurationInput,
  UpdateSchoolConfigurationInput,
  UpdateStaffMemberProfileInput,
  UpdateStaffMemberStatusInput,
} from '../workflows/setup'
import type {
  CloseEnrollmentInput,
  CreateStudentNoteInput,
  EnrollStudentInput,
  GraduateStudentInput,
  LinkGuardianToStudentInput,
  PromoteStudentInput,
  RecordProgressionDecisionInput,
  RegisterGuardianInput,
  RegisterStudentInput,
  StudentServiceWorkflow,
  TransferStudentInput,
  UpdateGuardianContactMethodsInput,
  UpdateGuardianStudentLinkInput,
  UpdateStudentNoteInput,
  UpdateStudentProfileInput,
  UpdateStudentStatusInput,
  UpsertStudentHealthProfileInput,
} from '../workflows/student'

export interface SchoolWorkflowHandlers {
  readonly setup: SetupServiceWorkflow
  readonly accessControl: AccessControlServiceWorkflow
  readonly accountInvitation: AccountInvitationServiceWorkflow
  readonly academics: AcademicsServiceWorkflow
  readonly assessments: AssessmentsServiceWorkflow
  readonly student: StudentServiceWorkflow
  readonly scheduling: SchedulingServiceWorkflow
  readonly communications: CommunicationsServiceWorkflow
  readonly behavior: BehaviorServiceWorkflow
  readonly finance: FinanceServiceWorkflow
  readonly notificationTemplates: NotificationTemplatesServiceWorkflow
}

export type SchoolCommandHandlerMap = {
  readonly [Key in SchoolCommandKey]: (payload: unknown) => Promise<unknown>
}

export function createSchoolCommandHandlers(workflows: SchoolWorkflowHandlers): SchoolCommandHandlerMap {
  return {
    // setup
    registerSchool: payload => workflows.setup.registerSchool(payload as RegisterSchoolInput),
    updateSchoolConfiguration: payload => workflows.setup.updateSchoolConfiguration(payload as UpdateSchoolConfigurationInput),
    createAcademicYear: payload => workflows.setup.createAcademicYear(payload as CreateAcademicYearInput),
    activateAcademicYear: payload => workflows.setup.activateAcademicYear(payload as ActivateAcademicYearInput),
    createAcademicPeriod: payload => workflows.setup.createAcademicPeriod(payload as CreateAcademicPeriodInput),
    publishAcademicPeriod: payload => workflows.setup.publishAcademicPeriod(payload as PublishAcademicPeriodInput),
    configureGradeLevel: payload => workflows.setup.configureGradeLevel(payload as ConfigureGradeLevelInput),
    configurePeriodDefinition: payload => workflows.setup.configurePeriodDefinition(payload as ConfigurePeriodDefinitionInput),
    configureResource: payload => workflows.setup.configureResource(payload as ConfigureResourceInput),
    configureActivity: payload => workflows.setup.configureActivity(payload as ConfigureActivityInput),
    enrollStudentInActivity: payload => workflows.setup.enrollStudentInActivity(payload as EnrollStudentInActivityInput),
    createClassGroup: payload => workflows.setup.createClassGroup(payload as CreateClassGroupInput),
    updateClassGroupConfiguration: payload => workflows.setup.updateClassGroupConfiguration(payload as UpdateClassGroupConfigurationInput),
    registerStaffMember: payload => workflows.setup.registerStaffMember(payload as RegisterStaffMemberInput),
    updateStaffMemberStatus: payload => workflows.setup.updateStaffMemberStatus(payload as UpdateStaffMemberStatusInput),
    updateStaffMemberProfile: payload => workflows.setup.updateStaffMemberProfile(payload as UpdateStaffMemberProfileInput),
    assignStaffToClass: payload => workflows.setup.assignStaffToClass(payload as AssignStaffInput),
    assignStaffToClassSubject: payload => workflows.setup.assignStaffToClassSubject(payload as AssignStaffInput),
    assignStaffToLessonSession: payload => workflows.setup.assignStaffToLessonSession(payload as AssignStaffInput),
    assignStaffPermission: payload => workflows.accessControl.assignStaffPermission(payload as StaffPermissionAssignmentInput),
    assignResourceToClass: payload => workflows.setup.assignResourceToClass(payload as AssignResourceInput),
    assignResourceToLessonSession: payload => workflows.setup.assignResourceToLessonSession(payload as AssignResourceInput),
    removeResourceAssignment: payload => workflows.setup.removeResourceAssignment(payload as RemoveResourceAssignmentInput),
    registerAttachment: payload => workflows.setup.registerAttachment(payload as RegisterAttachmentInput),
    removeAttachment: payload => workflows.setup.removeAttachment(payload as RemoveAttachmentInput),
    // accessControl
    linkActorSubject: payload => workflows.accessControl.linkActorSubject(payload as LinkActorSubjectInput),
    relinkActorSubject: payload => workflows.accessControl.relinkActorSubject(payload as LinkActorSubjectInput),
    sendAccountInvitation: payload => workflows.accountInvitation.sendAccountInvitation(payload as SendAccountInvitationInput),
    resendAccountInvitation: payload => workflows.accountInvitation.resendAccountInvitation(payload as ResendAccountInvitationInput),
    revokeAccountInvitation: payload => workflows.accountInvitation.revokeAccountInvitation(payload as RevokeAccountInvitationInput),
    acceptAccountInvitation: payload => workflows.accountInvitation.acceptAccountInvitation(payload as AcceptAccountInvitationInput),
    // academics
    configureSubject: payload => workflows.academics.configureSubject(payload as ConfigureSubjectInput),
    configureSubjectMatter: payload => workflows.academics.configureSubjectMatter(payload as ConfigureSubjectMatterInput),
    offerSubjectToClass: payload => workflows.academics.offerSubjectToClass(payload as OfferSubjectToClassInput),
    assignMatterToClassSubject: payload => workflows.academics.assignMatterToClassSubject(payload as AssignMatterToClassSubjectInput),
    offerSubjectToGradeLevel: payload => workflows.academics.offerSubjectToGradeLevel(payload as OfferSubjectToGradeLevelInput),
    removeSubjectFromGradeLevel: payload => workflows.academics.removeSubjectFromGradeLevel(payload as RemoveSubjectFromGradeLevelInput),
    updateGradeLevelSubject: payload => workflows.academics.updateGradeLevelSubject(payload as UpdateGradeLevelSubjectInput),
    assignMatterToGradeLevelSubject: payload => workflows.academics.assignMatterToGradeLevelSubject(payload as AssignMatterToGradeLevelSubjectInput),
    addCustomClassSubject: payload => workflows.academics.addCustomClassSubject(payload as AddCustomClassSubjectInput),
    setClassSubjectOffered: payload => workflows.academics.setClassSubjectOffered(payload as SetClassSubjectOfferedInput),
    recordLessonSessionProgress: payload => workflows.academics.recordLessonSessionProgress(payload as RecordLessonSessionProgressInput),
    // assessments
    createGradeScale: payload => workflows.assessments.createGradeScale(payload as CreateGradeScaleInput),
    createReportCardDefinition: payload => workflows.assessments.createReportCardDefinition(payload as CreateReportCardDefinitionInput),
    createReportCardDefinitionSection: payload => workflows.assessments.createReportCardDefinitionSection(payload as CreateReportCardDefinitionSectionInput),
    createAssessment: payload => workflows.assessments.createAssessment(payload as CreateAssessmentInput),
    completeAssessment: payload => workflows.assessments.completeAssessment(payload as CompleteAssessmentInput),
    recordAssessmentResult: payload => workflows.assessments.recordAssessmentResult(payload as RecordAssessmentResultInput),
    recordAssessmentResultCompliance: payload => workflows.assessments.recordAssessmentResultCompliance(payload as RecordAssessmentResultInput),
    listClassSubjectAssessmentResultsForPeriod: payload => workflows.assessments.listClassSubjectAssessmentResultsForPeriod(payload as ListClassSubjectAssessmentResultsForPeriodInput),
    generateReportCardResult: payload => workflows.assessments.generateReportCardResult(payload as GenerateReportCardResultInput),
    publishReportCardResult: payload => workflows.assessments.publishReportCardResult(payload as PublishReportCardResultInput),
    // student
    registerStudent: payload => workflows.student.registerStudent(payload as RegisterStudentInput),
    enrollStudent: payload => workflows.student.enrollStudent(payload as EnrollStudentInput),
    linkGuardianToStudent: payload => workflows.student.linkGuardianToStudent(payload as LinkGuardianToStudentInput),
    registerGuardian: payload => workflows.student.registerGuardian(payload as RegisterGuardianInput),
    promoteStudent: payload => workflows.student.promoteStudent(payload as PromoteStudentInput),
    transferStudent: payload => workflows.student.transferStudent(payload as TransferStudentInput),
    graduateStudent: payload => workflows.student.graduateStudent(payload as GraduateStudentInput),
    closeEnrollment: payload => workflows.student.closeEnrollment(payload as CloseEnrollmentInput),
    recordProgressionDecision: payload => workflows.student.recordProgressionDecision(payload as RecordProgressionDecisionInput),
    updateStudentProfile: payload => workflows.student.updateStudentProfile(payload as UpdateStudentProfileInput),
    updateStudentStatus: payload => workflows.student.updateStudentStatus(payload as UpdateStudentStatusInput),
    upsertStudentHealthProfile: payload => workflows.student.upsertStudentHealthProfile(payload as UpsertStudentHealthProfileInput),
    createStudentNote: payload => workflows.student.createStudentNote(payload as CreateStudentNoteInput),
    updateStudentNote: payload => workflows.student.updateStudentNote(payload as UpdateStudentNoteInput),
    updateGuardianContactMethods: payload => workflows.student.updateGuardianContactMethods(payload as UpdateGuardianContactMethodsInput),
    updateGuardianStudentLink: payload => workflows.student.updateGuardianStudentLink(payload as UpdateGuardianStudentLinkInput),
    // scheduling
    createSchedule: payload => workflows.scheduling.createSchedule(payload as CreateScheduleInput),
    saveSchedule: payload => workflows.scheduling.saveSchedule(payload as SaveScheduleInput),
    materializeSchedule: payload => workflows.scheduling.materializeSchedule(payload as MaterializeScheduleInput),
    createCalendarEvent: payload => workflows.scheduling.createCalendarEvent(payload as CreateCalendarEventInput),
    cancelLessonSession: payload => workflows.scheduling.cancelLessonSession(payload as CancelLessonSessionInput),
    cancelActivitySession: payload => workflows.scheduling.cancelActivitySession(payload as CancelActivitySessionInput),
    rescheduleOccurrence: payload => workflows.scheduling.rescheduleOccurrence(payload as RescheduleOccurrenceInput),
    recordAttendance: payload => workflows.scheduling.recordAttendance(payload as RecordAttendanceInput),
    recordDailyAttendance: payload => workflows.scheduling.recordDailyAttendance(payload as RecordDailyAttendanceInput),
    recordLessonSessionAttendance: payload => workflows.scheduling.recordLessonSessionAttendance(payload as RecordLessonSessionAttendanceInput),
    recordClassDailyAttendance: payload => workflows.scheduling.recordClassDailyAttendance(payload as RecordClassDailyAttendanceInput),
    reviewAttendanceJustification: payload => workflows.scheduling.reviewAttendanceJustification(payload as ReviewAttendanceJustificationInput),
    requestAttendanceJustification: payload => workflows.scheduling.requestAttendanceJustification(payload as RequestAttendanceJustificationInput),
    // communications
    createAnnouncement: payload => workflows.communications.createAnnouncement(payload as CreateAnnouncementInput),
    addTarget: payload => workflows.communications.addTarget(payload as AddAnnouncementTargetInput),
    publishAnnouncement: payload => workflows.communications.publishAnnouncement(payload as PublishAnnouncementInput),
    recordDelivery: payload => workflows.communications.recordDelivery(payload as RecordDeliveryInput),
    materializeDeliveries: payload => workflows.communications.materializeDeliveries(payload as MaterializeDeliveriesInput),
    applyDeliveryEvent: payload => workflows.communications.applyDeliveryEvent(payload as ApplyDeliveryEventInput),
    markDeliveryRead: payload => workflows.communications.markDeliveryRead(payload as MarkDeliveryReadInput),
    updateNotificationContact: payload => workflows.communications.updateNotificationContact(payload as UpdateNotificationContactInput),
    registerPushDevice: payload => workflows.communications.registerPushDevice(payload as RegisterPushDeviceInput),
    unregisterPushDevice: payload => workflows.communications.unregisterPushDevice(payload as UnregisterPushDeviceInput),
    updateSchoolNotificationTemplates: payload =>
      workflows.notificationTemplates.updateSchoolNotificationTemplates(payload as UpdateSchoolNotificationTemplatesInput),
    resetSchoolNotificationTemplates: payload =>
      workflows.notificationTemplates.resetSchoolNotificationTemplates(payload as ResetSchoolNotificationTemplatesInput),
    // behavior
    recordIncident: payload => workflows.behavior.recordIncident(payload as RecordIncidentInput),
    addStudentInvolvement: payload => workflows.behavior.addStudentInvolvement(payload as AddStudentInvolvementInput),
    configureDisciplinaryAction: payload => workflows.behavior.configureDisciplinaryAction(payload as ConfigureDisciplinaryActionInput),
    applyDisciplinaryAction: payload => workflows.behavior.applyDisciplinaryAction(payload as ApplyDisciplinaryActionInput),
    updateStudentDisciplinaryActionStatus: payload => workflows.behavior.updateStudentDisciplinaryActionStatus(payload as UpdateStudentDisciplinaryActionStatusInput),
    resolveIncident: payload => workflows.behavior.resolveIncident(payload as ResolveIncidentInput),
    resolveIncidentWithOutcomes: payload => workflows.behavior.resolveIncidentWithOutcomes(payload as ResolveIncidentWithOutcomesInput),
    // finance
    createFee: payload => workflows.finance.createFee(payload as CreateFeeInput),
    assignFeeToStudent: payload => workflows.finance.assignFeeToStudent(payload as AssignFeeToStudentInput),
    recordPayment: payload => workflows.finance.recordPayment(payload as RecordPaymentInput),
    reversePayment: payload => workflows.finance.reversePayment(payload as UpdatePaymentStatusInput),
    cancelPayment: payload => workflows.finance.cancelPayment(payload as UpdatePaymentStatusInput),
    adjustStudentFee: payload => workflows.finance.adjustStudentFee(payload as AdjustStudentFeeInput),
    cancelStudentFee: payload => workflows.finance.cancelStudentFee(payload as CancelStudentFeeInput),
  }
}

export function dispatchSchoolCommand(
  handlers: SchoolCommandHandlerMap,
  methodName: SchoolCommandKey,
  payload: unknown,
): Promise<unknown> {
  return handlers[methodName](payload)
}
