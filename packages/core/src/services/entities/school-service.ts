import type {
  Announcement,
  AttendanceRecord,
  ClassSubjectProgress,
  Incident,
  MessageDelivery,
  Payment,
  ReportCardResult,
  Session,
  StudentClassEnrollment,
  StudentDisciplinaryAction,
  StudentFee,
  StudentIncidentInvolvement,
} from '../../entities'
import type { ServiceArgs } from '../shared/service-args'
import type { RecordSessionProgressInput } from './service-workflows/accademics'
import type { PublishReportCardResultInput } from './service-workflows/assessments'
import type {
  AddStudentInvolvementInput,
  ApplyDisciplinaryActionInput,
  RecordIncidentInput,
  ResolveIncidentInput,
  UpdateStudentDisciplinaryActionStatusInput,
} from './service-workflows/behavior'
import type {
  MaterializeDeliveriesInput,
  PublishAnnouncementInput,
  RecordDeliveryInput,
} from './service-workflows/communications'
import type {
  AdjustStudentFeeInput,
  AssignFeeToStudentInput,
  CancelStudentFeeInput,
  RecordPaymentInput,
  UpdatePaymentStatusInput,
} from './service-workflows/finance'
import type {
  GenerateSessionsInput,
  RecordAttendanceInput,
  RecordClassDailyAttendanceInput,
  RecordDailyAttendanceInput,
  RecordSessionAttendanceInput,
  ReviewAttendanceJustificationInput,
} from './service-workflows/scheduling'
import type {
  CloseEnrollmentInput,
  GraduateStudentInput,
  PromoteStudentInput,
  RecordProgressionDecisionInput,
  TransferStudentInput,
} from './service-workflows/student'
import {
  PaymentStatus,
} from '../../entities'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization'
import { BaseSchoolService } from './base-school-service'
import { AcademicsServiceWorkflow } from './service-workflows/accademics'
import { AssessmentsServiceWorkflow } from './service-workflows/assessments'
import { BehaviorServiceWorkflow } from './service-workflows/behavior'
import { CommunicationsServiceWorkflow } from './service-workflows/communications'
import { FinanceServiceWorkflow } from './service-workflows/finance'
import { SchedulingServiceWorkflow } from './service-workflows/scheduling'
import { StudentServiceWorkflow } from './service-workflows/student'

export class SchoolService {
  readonly base: BaseSchoolService
  readonly academicsWorkflow: AcademicsServiceWorkflow
  readonly financeWorkflow: FinanceServiceWorkflow
  readonly assessmentsWorkflow: AssessmentsServiceWorkflow
  readonly studentWorkflow: StudentServiceWorkflow
  readonly schedulingWorkflow: SchedulingServiceWorkflow
  readonly communicationsWorkflow: CommunicationsServiceWorkflow
  readonly behaviorWorkflow: BehaviorServiceWorkflow

  constructor(args: ServiceArgs) {
    this.base = new BaseSchoolService(args)
    this.academicsWorkflow = new AcademicsServiceWorkflow(this.base)
    this.financeWorkflow = new FinanceServiceWorkflow(this.base)
    this.assessmentsWorkflow = new AssessmentsServiceWorkflow(this.base)
    this.studentWorkflow = new StudentServiceWorkflow(this.base)
    this.schedulingWorkflow = new SchedulingServiceWorkflow(this.base)
    this.communicationsWorkflow = new CommunicationsServiceWorkflow(this.base)
    this.behaviorWorkflow = new BehaviorServiceWorkflow(this.base)
  }

  // REPORTS AND DASHBOARD ENDPOINTS

  async getOverdueFeeCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'query.get_overdue_fees')
    return this.base.repositories.schools.getOverdueFeeCount(schoolId)
  }

  async getPublishedReportCardCount(schoolId: string): Promise<number> {
    this.checkActorSchool(schoolId)
    await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'queries.read_report_card_detail')
    return this.base.repositories.schools.getPublishedReportCardCount(schoolId)
  }

  // ACADEMICS ENDPOINTS

  async recordSessionProgress(args: RecordSessionProgressInput): Promise<ClassSubjectProgress> {
    return this.academicsWorkflow.recordSessionProgress(args)
  }

  // ASSESSMENTS ENDPOINTS

  async publishReportCardResult(input: PublishReportCardResultInput): Promise<ReportCardResult> {
    return this.assessmentsWorkflow.publishReportCardResult(input)
  }

  // STUDENTS ENDPOINTS

  async closeEnrollment(input: CloseEnrollmentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.closeEnrollment(input)
  }

  async recordProgressionDecision(input: RecordProgressionDecisionInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.recordProgressionDecision(input)
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

  async reviewAttendanceJustification(input: ReviewAttendanceJustificationInput): Promise<AttendanceRecord> {
    return this.schedulingWorkflow.reviewAttendanceJustification(input)
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

  async adjustStudentFee(input: AdjustStudentFeeInput): Promise<StudentFee> {
    return this.financeWorkflow.adjustStudentFee(input)
  }

  async cancelStudentFee(input: CancelStudentFeeInput): Promise<StudentFee> {
    return this.financeWorkflow.cancelStudentFee(input)
  }

  // Private utilities

  private checkActorSchool(schoolId: string): void {
    if (schoolId !== this.base.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
