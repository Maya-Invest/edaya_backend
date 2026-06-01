import type {
  ClassSubjectProgress,
  Payment,
  ReportCardResult,
  StudentClassEnrollment,
  StudentFee,
} from '../../entities'
import type { ServiceArgs } from '../shared/service-args'
import type { RecordSessionProgressInput } from './service-workflows/accademics'
import type { PublishReportCardResultInput } from './service-workflows/assessments'
import type { AssignFeeToStudentInput, RecordPaymentInput, UpdatePaymentStatusInput } from './service-workflows/finance'
import type { PromoteStudentInput, TransferStudentInput } from './service-workflows/student'
import {
  PaymentStatus,
} from '../../entities'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization'
import { BaseSchoolService } from './base-school-service'
import { AcademicsServiceWorkflow } from './service-workflows/accademics'
import { AssessmentsServiceWorkflow } from './service-workflows/assessments'
import { FinanceServiceWorkflow } from './service-workflows/finance'
import { StudentServiceWorkflow } from './service-workflows/student'

export class SchoolService {
  readonly base: BaseSchoolService
  readonly academicsWorkflow: AcademicsServiceWorkflow
  readonly financeWorkflow: FinanceServiceWorkflow
  readonly assessmentsWorkflow: AssessmentsServiceWorkflow
  readonly studentWorkflow: StudentServiceWorkflow

  constructor(args: ServiceArgs) {
    this.base = new BaseSchoolService(args)
    this.academicsWorkflow = new AcademicsServiceWorkflow(this.base)
    this.financeWorkflow = new FinanceServiceWorkflow(this.base)
    this.assessmentsWorkflow = new AssessmentsServiceWorkflow(this.base)
    this.studentWorkflow = new StudentServiceWorkflow(this.base)
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

  async promoteStudent(input: PromoteStudentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.promoteStudent(input)
  }

  async transferStudent(input: TransferStudentInput): Promise<StudentClassEnrollment> {
    return this.studentWorkflow.transferStudent(input)
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
    if (schoolId !== this.base.actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}
