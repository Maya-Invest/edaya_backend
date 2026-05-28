import type { Fee } from '../../../entities/finances/fee'
import type { Payment } from '../../../entities/finances/payment'
import type { StudentFee, StudentFeeSummary } from '../../../entities/finances/student-fee'
import type { Student } from '../../../entities/students/student'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { buildStudentFeeSummary } from '../../../entities/finances/student-fee'
import { denyResourceAccess } from '../../authorization'

export interface FinanceLedgerItem {
  studentFee: StudentFee
  fee: Fee
  payments: Payment[]
}

export interface FinanceLedger {
  student: Student
  academicYearId?: string
  items: FinanceLedgerItem[]
  summary: StudentFeeSummary
}

export class FinanceLedgerService {
  constructor(args: ServiceArgs) {
    this.students = args.repositories.students
    this.fees = args.repositories.fees
    this.studentFees = args.repositories.studentFees
    this.payments = args.repositories.payments
  }

  private readonly students: SchoolRepositories['students']
  private readonly fees: SchoolRepositories['fees']
  private readonly studentFees: SchoolRepositories['studentFees']
  private readonly payments: SchoolRepositories['payments']

  async getFinanceLedger({
    schoolId,
    studentId,
    academicYearId,
  }: {
    schoolId: string
    studentId: string
    academicYearId?: string
  }): Promise<FinanceLedger> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }

    const studentFees = (await this.studentFees.list({ studentId }))
      .filter(studentFee => !academicYearId || studentFee.academicYearId === academicYearId)
      .sort((left, right) => {
        const leftDueDate = left.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
        const rightDueDate = right.dueDate?.getTime() ?? Number.MAX_SAFE_INTEGER
        return leftDueDate - rightDueDate || left.id.localeCompare(right.id)
      })

    const items = await Promise.all(studentFees.map(async (studentFee) => {
      const fee = await this.fees.findById(studentFee.feeId)
      if (!fee || fee.schoolId !== schoolId || fee.academicYearId !== studentFee.academicYearId) {
        denyResourceAccess()
      }
      const payments = (await this.payments.list({ studentFeeId: studentFee.id }))
        .sort((left, right) => right.paymentDate.getTime() - left.paymentDate.getTime() || left.id.localeCompare(right.id))
      return { studentFee, fee, payments }
    }))

    return {
      student,
      academicYearId,
      items,
      summary: buildStudentFeeSummary(studentFees),
    }
  }
}
