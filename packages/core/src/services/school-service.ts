import type {
  AcademicPeriod,
  AcademicYear,
  Announcement,
  AnnouncementTarget,
  Assessment,
  AssessmentResult,
  Attachment,
  AttendanceRecord,
  CalendarEvent,
  ClassGroup,
  ClassSubject,
  ClassSubjectMatter,
  ClassSubjectProgress,
  Fee,
  GradeScale,
  Guardian,
  GuardianStudentLink,
  Incident,
  MessageDelivery,
  Payment,
  ReportCardDefinition,
  ReportCardDefinitionSection,
  ReportCardResult,
  ResourceAssignment,
  Schedule,
  School,
  Session,
  StaffAssignment,
  StaffMember,
  Student,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentHealthProfile,
  StudentIncidentInvolvement,
  StudentNote,
} from '../domains'
import type { ServiceArgs } from '../shared/service-args'
import type {
  AssignMatterToClassSubjectInput,
  OfferSubjectToClassInput,
  RecordSessionProgressInput,
} from './service-workflows/accademics'
import type {
  CompleteAssessmentInput,
  CreateAssessmentInput,
  CreateGradeScaleInput,
  CreateReportCardDefinitionInput,
  CreateReportCardDefinitionSectionInput,
  GenerateReportCardResultInput,
  ListClassSubjectAssessmentResultsForPeriodInput,
  PublishReportCardResultInput,
  RecordAssessmentResultInput,
} from './service-workflows/assessments'
import type {
  AddStudentInvolvementInput,
  ApplyDisciplinaryActionInput,
  RecordIncidentInput,
  ResolveIncidentInput,
  UpdateStudentDisciplinaryActionStatusInput,
} from './service-workflows/behavior'
import type {
  AddAnnouncementTargetInput,
  CreateAnnouncementInput,
  MaterializeDeliveriesInput,
  PublishAnnouncementInput,
  RecordDeliveryInput,
} from './service-workflows/communications'
import type {
  AdjustStudentFeeInput,
  AssignFeeToStudentInput,
  CancelStudentFeeInput,
  CreateFeeInput,
  RecordPaymentInput,
  UpdatePaymentStatusInput,
} from './service-workflows/finance'
import type {
  CreateCalendarEventInput,
  CreateScheduleInput,
  CreateSessionInput,
  GenerateSessionsInput,
  RecordAttendanceInput,
  RecordClassDailyAttendanceInput,
  RecordDailyAttendanceInput,
  RecordSessionAttendanceInput,
  ReviewAttendanceJustificationInput,
} from './service-workflows/scheduling'
import type {
  ActivateAcademicYearInput,
  AssignResourceInput,
  AssignStaffInput,
  CreateAcademicPeriodInput,
  CreateAcademicYearInput,
  CreateClassGroupInput,
  PublishAcademicPeriodInput,
  RegisterAttachmentInput,
  RegisterSchoolInput,
  RegisterStaffMemberInput,
  RemoveAttachmentInput,
  RemoveResourceAssignmentInput,
  UpdateClassGroupConfigurationInput,
  UpdateSchoolConfigurationInput,
  UpdateStaffMemberStatusInput,
} from './service-workflows/setup'
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
  TransferStudentInput,
  UpdateGuardianContactMethodsInput,
  UpdateGuardianStudentLinkInput,
  UpdateStudentNoteInput,
  UpdateStudentProfileInput,
  UpdateStudentStatusInput,
  UpsertStudentHealthProfileInput,
} from './service-workflows/student'
import { AuthorizationError, AuthorizationErrorCode, Permission } from '../authorization'
import { permissionAction } from '../shared'
import { BaseSchoolService } from './base-school-service'
import { AcademicsServiceWorkflow } from './service-workflows/accademics'
import { AssessmentsServiceWorkflow } from './service-workflows/assessments'
import { BehaviorServiceWorkflow } from './service-workflows/behavior'
import { CommunicationsServiceWorkflow } from './service-workflows/communications'
import { FinanceServiceWorkflow } from './service-workflows/finance'
import { SchedulingServiceWorkflow } from './service-workflows/scheduling'
import { SetupServiceWorkflow } from './service-workflows/setup'
import { StudentServiceWorkflow } from './service-workflows/student'

export class SchoolService {
  readonly baseService: BaseSchoolService
  readonly academicsWorkflow: AcademicsServiceWorkflow
  readonly financeWorkflow: FinanceServiceWorkflow
  readonly assessmentsWorkflow: AssessmentsServiceWorkflow
  readonly studentWorkflow: StudentServiceWorkflow
  readonly schedulingWorkflow: SchedulingServiceWorkflow
  readonly setupWorkflow: SetupServiceWorkflow
  readonly communicationsWorkflow: CommunicationsServiceWorkflow
  readonly behaviorWorkflow: BehaviorServiceWorkflow

  constructor(args: ServiceArgs) {
    this.baseService = new BaseSchoolService(args)
    this.academicsWorkflow = new AcademicsServiceWorkflow(this.baseService)
    this.financeWorkflow = new FinanceServiceWorkflow(this.baseService)
    this.assessmentsWorkflow = new AssessmentsServiceWorkflow(this.baseService)
    this.studentWorkflow = new StudentServiceWorkflow(this.baseService)
    this.schedulingWorkflow = new SchedulingServiceWorkflow(this.baseService)
    this.setupWorkflow = new SetupServiceWorkflow(this.baseService)
    this.communicationsWorkflow = new CommunicationsServiceWorkflow(this.baseService)
    this.behaviorWorkflow = new BehaviorServiceWorkflow(this.baseService)
  }

  // REPORTS AND DASHBOARD ENDPOINTS

  async getOverdueFeeCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    permissionAction(Permission.QUERY_OVERDUE_FEES_READ)(this.baseService.actor)
    return this.baseService.repositories.schools.getOverdueFeeCount(schoolId)
  }

  async getPublishedReportCardCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    permissionAction(Permission.QUERY_REPORT_CARD_DETAIL_READ)(this.baseService.actor)
    return this.baseService.repositories.schools.getPublishedReportCardCount(schoolId)
  }

  // SETUP ENDPOINTS

  async registerSchool(input: RegisterSchoolInput): Promise<School> {
    return this.setupWorkflow.registerSchool(input)
  }

  async updateSchoolConfiguration(input: UpdateSchoolConfigurationInput): Promise<School> {
    return this.setupWorkflow.updateSchoolConfiguration(input)
  }

  async createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> {
    return this.setupWorkflow.createAcademicYear(input)
  }

  async activateAcademicYear(input: ActivateAcademicYearInput): Promise<AcademicYear> {
    return this.setupWorkflow.activateAcademicYear(input)
  }

  async createAcademicPeriod(input: CreateAcademicPeriodInput): Promise<AcademicPeriod> {
    return this.setupWorkflow.createAcademicPeriod(input)
  }

  async publishAcademicPeriod(input: PublishAcademicPeriodInput): Promise<AcademicPeriod> {
    return this.setupWorkflow.publishAcademicPeriod(input)
  }

  async createClassGroup(input: CreateClassGroupInput): Promise<ClassGroup> {
    return this.setupWorkflow.createClassGroup(input)
  }

  async updateClassGroupConfiguration(input: UpdateClassGroupConfigurationInput): Promise<ClassGroup> {
    return this.setupWorkflow.updateClassGroupConfiguration(input)
  }

  async registerStaffMember(input: RegisterStaffMemberInput): Promise<StaffMember> {
    return this.setupWorkflow.registerStaffMember(input)
  }

  async updateStaffMemberStatus(input: UpdateStaffMemberStatusInput): Promise<StaffMember> {
    return this.setupWorkflow.updateStaffMemberStatus(input)
  }

  async assignStaffToClass(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.setupWorkflow.assignStaffToClass(input)
  }

  async assignStaffToClassSubject(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.setupWorkflow.assignStaffToClassSubject(input)
  }

  async assignStaffToSession(input: AssignStaffInput): Promise<StaffAssignment> {
    return this.setupWorkflow.assignStaffToSession(input)
  }

  async assignResourceToClass(input: AssignResourceInput): Promise<ResourceAssignment> {
    return this.setupWorkflow.assignResourceToClass(input)
  }

  async assignResourceToSession(input: AssignResourceInput): Promise<ResourceAssignment> {
    return this.setupWorkflow.assignResourceToSession(input)
  }

  async removeResourceAssignment(input: RemoveResourceAssignmentInput): Promise<void> {
    return this.setupWorkflow.removeResourceAssignment(input)
  }

  async registerAttachment(input: RegisterAttachmentInput): Promise<Attachment> {
    return this.setupWorkflow.registerAttachment(input)
  }

  async removeAttachment(input: RemoveAttachmentInput): Promise<void> {
    return this.setupWorkflow.removeAttachment(input)
  }

  // ACADEMICS ENDPOINTS

  async offerSubjectToClass(input: OfferSubjectToClassInput): Promise<ClassSubject> {
    return this.academicsWorkflow.offerSubjectToClass(input)
  }

  async assignMatterToClassSubject(input: AssignMatterToClassSubjectInput): Promise<ClassSubjectMatter> {
    return this.academicsWorkflow.assignMatterToClassSubject(input)
  }

  async recordSessionProgress(args: RecordSessionProgressInput): Promise<ClassSubjectProgress> {
    return this.academicsWorkflow.recordSessionProgress(args)
  }

  // ASSESSMENTS ENDPOINTS

  async createGradeScale(input: CreateGradeScaleInput): Promise<GradeScale> {
    return this.assessmentsWorkflow.createGradeScale(input)
  }

  async createReportCardDefinition(input: CreateReportCardDefinitionInput): Promise<ReportCardDefinition> {
    return this.assessmentsWorkflow.createReportCardDefinition(input)
  }

  async createReportCardDefinitionSection(input: CreateReportCardDefinitionSectionInput): Promise<ReportCardDefinitionSection> {
    return this.assessmentsWorkflow.createReportCardDefinitionSection(input)
  }

  async createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
    return this.assessmentsWorkflow.createAssessment(input)
  }

  async completeAssessment(input: CompleteAssessmentInput): Promise<Assessment> {
    return this.assessmentsWorkflow.completeAssessment(input)
  }

  async recordAssessmentResult(input: RecordAssessmentResultInput): Promise<AssessmentResult> {
    return this.assessmentsWorkflow.recordAssessmentResult(input)
  }

  async recordAssessmentResultCompliance(input: RecordAssessmentResultInput): Promise<AssessmentResult> {
    return this.assessmentsWorkflow.recordAssessmentResultCompliance(input)
  }

  async listClassSubjectAssessmentResultsForPeriod(input: ListClassSubjectAssessmentResultsForPeriodInput): Promise<AssessmentResult[]> {
    return this.assessmentsWorkflow.listClassSubjectAssessmentResultsForPeriod(input)
  }

  async generateReportCardResult(input: GenerateReportCardResultInput): Promise<ReportCardResult> {
    return this.assessmentsWorkflow.generateReportCardResult(input)
  }

  async publishReportCardResult(input: PublishReportCardResultInput): Promise<ReportCardResult> {
    return this.assessmentsWorkflow.publishReportCardResult(input)
  }

  // STUDENTS ENDPOINTS

  async registerStudent(input: RegisterStudentInput): Promise<Student> {
    return this.studentWorkflow.registerStudent(input)
  }

  async enrollStudent(input: EnrollStudentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.enrollStudent(input)
  }

  async linkGuardianToStudent(input: LinkGuardianToStudentInput): Promise<GuardianStudentLink> {
    return this.studentWorkflow.linkGuardianToStudent(input)
  }

  async registerGuardian(input: RegisterGuardianInput): Promise<Guardian> {
    return this.studentWorkflow.registerGuardian(input)
  }

  async promoteStudent(input: PromoteStudentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.promoteStudent(input)
  }

  async transferStudent(input: TransferStudentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.transferStudent(input)
  }

  async graduateStudent(input: GraduateStudentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.graduateStudent(input)
  }

  async closeEnrollment(input: CloseEnrollmentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.closeEnrollment(input)
  }

  async recordProgressionDecision(input: RecordProgressionDecisionInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.recordProgressionDecision(input)
  }

  async updateStudentProfile(input: UpdateStudentProfileInput): Promise<Student> {
    return this.studentWorkflow.updateStudentProfile(input)
  }

  async updateStudentStatus(input: UpdateStudentStatusInput): Promise<Student> {
    return this.studentWorkflow.updateStudentStatus(input)
  }

  async upsertStudentHealthProfile(input: UpsertStudentHealthProfileInput): Promise<StudentHealthProfile> {
    return this.studentWorkflow.upsertStudentHealthProfile(input)
  }

  async createStudentNote(input: CreateStudentNoteInput): Promise<StudentNote> {
    return this.studentWorkflow.createStudentNote(input)
  }

  async updateStudentNote(input: UpdateStudentNoteInput): Promise<StudentNote> {
    return this.studentWorkflow.updateStudentNote(input)
  }

  async updateGuardianContactMethods(input: UpdateGuardianContactMethodsInput): Promise<Guardian> {
    return this.studentWorkflow.updateGuardianContactMethods(input)
  }

  async updateGuardianStudentLink(input: UpdateGuardianStudentLinkInput): Promise<GuardianStudentLink> {
    return this.studentWorkflow.updateGuardianStudentLink(input)
  }

  // SCHEDULING ENDPOINTS

  async createSchedule(input: CreateScheduleInput): Promise<Schedule> {
    return this.schedulingWorkflow.createSchedule(input)
  }

  async createCalendarEvent(input: CreateCalendarEventInput): Promise<CalendarEvent> {
    return this.schedulingWorkflow.createCalendarEvent(input)
  }

  async createSession(input: CreateSessionInput): Promise<Session> {
    return this.schedulingWorkflow.createSession(input)
  }

  async generateSessions(input: GenerateSessionsInput): Promise<Session[]> {
    return this.schedulingWorkflow.generateSessions(input)
  }

  async recordAttendance(input: RecordAttendanceInput): Promise<AttendanceRecord> {
    return this.schedulingWorkflow.recordAttendance(input)
  }

  async recordDailyAttendance(input: RecordDailyAttendanceInput): Promise<AttendanceRecord> {
    return this.schedulingWorkflow.recordDailyAttendance(input)
  }

  async recordSessionAttendance(input: RecordSessionAttendanceInput): Promise<AttendanceRecord[]> {
    return this.schedulingWorkflow.recordSessionAttendance(input)
  }

  async recordClassDailyAttendance(input: RecordClassDailyAttendanceInput): Promise<AttendanceRecord[]> {
    return this.schedulingWorkflow.recordClassDailyAttendance(input)
  }

  async reviewAttendanceJustification(input: ReviewAttendanceJustificationInput): Promise<AttendanceRecord> {
    return this.schedulingWorkflow.reviewAttendanceJustification(input)
  }

  // COMMUNICATIONS ENDPOINTS

  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    return this.communicationsWorkflow.createAnnouncement(input)
  }

  async addTarget(input: AddAnnouncementTargetInput): Promise<AnnouncementTarget> {
    return this.communicationsWorkflow.addTarget(input)
  }

  async publishAnnouncement(input: PublishAnnouncementInput): Promise<Announcement> {
    return this.communicationsWorkflow.publishAnnouncement(input)
  }

  async recordDelivery(input: RecordDeliveryInput): Promise<MessageDelivery> {
    return this.communicationsWorkflow.recordDelivery(input)
  }

  async materializeDeliveries(input: MaterializeDeliveriesInput): Promise<MessageDelivery[]> {
    return this.communicationsWorkflow.materializeDeliveries(input)
  }

  // BEHAVIOR ENDPOINTS

  async recordIncident(input: RecordIncidentInput): Promise<Incident> {
    return this.behaviorWorkflow.recordIncident(input)
  }

  async addStudentInvolvement(input: AddStudentInvolvementInput): Promise<StudentIncidentInvolvement> {
    return this.behaviorWorkflow.addStudentInvolvement(input)
  }

  async applyDisciplinaryAction(input: ApplyDisciplinaryActionInput): Promise<StudentDisciplinaryAction> {
    return this.behaviorWorkflow.applyDisciplinaryAction(input)
  }

  async updateStudentDisciplinaryActionStatus(input: UpdateStudentDisciplinaryActionStatusInput): Promise<StudentDisciplinaryAction> {
    return this.behaviorWorkflow.updateStudentDisciplinaryActionStatus(input)
  }

  async resolveIncident(input: ResolveIncidentInput): Promise<Incident> {
    return this.behaviorWorkflow.resolveIncident(input)
  }

  // FINANCE ENDPOINTS

  async createFee(input: CreateFeeInput): Promise<Fee> {
    return this.financeWorkflow.createFee(input)
  }

  async assignFeeToStudent(input: AssignFeeToStudentInput): Promise<StudentFee> {
    return this.financeWorkflow.assignFeeToStudent(input)
  }

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    return this.financeWorkflow.recordPayment(input)
  }

  async reversePayment(input: UpdatePaymentStatusInput): Promise<Payment> {
    return this.financeWorkflow.reversePayment(input)
  }

  async cancelPayment(input: UpdatePaymentStatusInput): Promise<Payment> {
    return this.financeWorkflow.cancelPayment(input)
  }

  async adjustStudentFee(input: AdjustStudentFeeInput): Promise<StudentFee> {
    return this.financeWorkflow.adjustStudentFee(input)
  }

  async cancelStudentFee(input: CancelStudentFeeInput): Promise<StudentFee> {
    return this.financeWorkflow.cancelStudentFee(input)
  }

  // Private utilities

  private checkActorSchool(schoolId: string): void {
    if (schoolId !== this.baseService.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
