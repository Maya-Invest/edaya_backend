import type {
  AcademicYear,
  Announcement,
  AttendanceRecord,
  ClassSubjectProgress,
  GuardianStudentLink,
  MessageDelivery,
  Payment,
  ReportCardResult,
  Session,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentIncidentInvolvement,
} from '../entities'
import type { ServiceArgs } from '../shared/service-args'
import type { RecordSessionProgressInput } from './service-workflows/accademics'
import type {
  GenerateReportCardResultInput,
  PublishReportCardResultInput,
} from './service-workflows/assessments'
import type {
  AddStudentInvolvementInput,
  ApplyDisciplinaryActionInput,
} from './service-workflows/behavior'
import type {
  MaterializeDeliveriesInput,
  PublishAnnouncementInput,
  RecordDeliveryInput,
} from './service-workflows/communications'
import type {
  AssignFeeToStudentInput,
  RecordPaymentInput,
  UpdatePaymentStatusInput,
} from './service-workflows/finance'
import type {
  GenerateSessionsInput,
  RecordAttendanceInput,
  RecordClassDailyAttendanceInput,
  RecordDailyAttendanceInput,
  RecordSessionAttendanceInput,
} from './service-workflows/scheduling'
import type {
  ActivateAcademicYearInput,
  CreateAcademicYearInput,
} from './service-workflows/setup'
import type {
  EnrollStudentInput,
  GraduateStudentInput,
  LinkGuardianToStudentInput,
  PromoteStudentInput,
  TransferStudentInput,
} from './service-workflows/student'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization'
import {
  PaymentStatus,
} from '../entities'
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
    await this.baseService.authorizationPolicy.checkGlobalAction(this.baseService.actor, 'query.get_overdue_fees')
    return this.baseService.repositories.schools.getOverdueFeeCount(schoolId)
  }

  async getPublishedReportCardCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    await this.baseService.authorizationPolicy.checkGlobalAction(this.baseService.actor, 'queries.read_report_card_detail')
    return this.baseService.repositories.schools.getPublishedReportCardCount(schoolId)
  }

  // SETUP ENDPOINTS

  async createAcademicYear(input: CreateAcademicYearInput): Promise<AcademicYear> {
    return this.setupWorkflow.createAcademicYear(input)
  }

  async activateAcademicYear(input: ActivateAcademicYearInput): Promise<AcademicYear> {
    return this.setupWorkflow.activateAcademicYear(input)
  }

  // ACADEMICS ENDPOINTS

  async recordSessionProgress(args: RecordSessionProgressInput): Promise<ClassSubjectProgress> {
    return this.academicsWorkflow.recordSessionProgress(args)
  }

  // ASSESSMENTS ENDPOINTS

  async generateReportCardResult(input: GenerateReportCardResultInput): Promise<ReportCardResult> {
    return this.assessmentsWorkflow.generateReportCardResult(input)
  }

  async publishReportCardResult(input: PublishReportCardResultInput): Promise<ReportCardResult> {
    return this.assessmentsWorkflow.publishReportCardResult(input)
  }

  // STUDENTS ENDPOINTS

  async enrollStudent(input: EnrollStudentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.enrollStudent(input)
  }

  async linkGuardianToStudent(input: LinkGuardianToStudentInput): Promise<GuardianStudentLink> {
    return this.studentWorkflow.linkGuardianToStudent(input)
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

  // SCHEDULING ENDPOINTS

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

  // COMMUNICATIONS ENDPOINTS

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

  async addStudentInvolvement(input: AddStudentInvolvementInput): Promise<StudentIncidentInvolvement> {
    return this.behaviorWorkflow.addStudentInvolvement(input)
  }

  async applyDisciplinaryAction(input: ApplyDisciplinaryActionInput): Promise<StudentDisciplinaryAction> {
    return this.behaviorWorkflow.applyDisciplinaryAction(input)
  }

  // FINANCE ENDPOINTS

  async assignFeeToStudent(input: AssignFeeToStudentInput): Promise<StudentFee> {
    return this.financeWorkflow.assignFeeToStudent(input)
  }

  async recordPayment(input: RecordPaymentInput): Promise<Payment> {
    return this.financeWorkflow.recordPayment(input)
  }

  async reversePayment(input: UpdatePaymentStatusInput): Promise<Payment> {
    return this.financeWorkflow.updatePaymentStatus({
      ...input,
      status: PaymentStatus.Reversed,
    })
  }

  async cancelPayment(input: UpdatePaymentStatusInput): Promise<Payment> {
    return this.financeWorkflow.updatePaymentStatus({
      ...input,
      status: PaymentStatus.Cancelled,
    })
  }

  // Private utilities

  private checkActorSchool(schoolId: string): void {
    if (schoolId !== this.baseService.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
