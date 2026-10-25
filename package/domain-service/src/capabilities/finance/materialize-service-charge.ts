import type { StudentCharge, StudentServiceEnrollment } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { BusinessRuleViolationError, ChargeStatus, materializeInstallments, oneTimeChargeId, StudentCharge as StudentChargeEntity } from '@edaya/core'

export async function materializeServiceCharge(base: BaseSchoolService, enrollment: StudentServiceEnrollment, dueDate?: Date): Promise<StudentCharge> {
  const chargeId = oneTimeChargeId(enrollment.id)
  const existing = await base.repositories.studentCharges.findById(chargeId)
  if (existing)
    return existing
  if (!enrollment.isActive)
    throw new BusinessRuleViolationError('ENROLLMENT_INACTIVE', `Enrollment ${enrollment.id} is not active`)
  const amount = enrollment.acceptedTerms.price
  const fallbackDue = dueDate ?? enrollment.acceptedTerms.billingTerms.singleDueDate
  const installments = materializeInstallments(chargeId, amount, enrollment.acceptedTerms.installmentTemplates, fallbackDue)
  const effectiveDue = fallbackDue ?? installments.at(-1)?.dueDate
  const charge = new StudentChargeEntity({
    id: chargeId,
    schoolId: enrollment.schoolId,
    studentId: enrollment.studentId,
    enrollmentId: enrollment.id,
    academicYearId: enrollment.academicYearId,
    label: enrollment.acceptedTerms.name,
    expectedAmount: amount,
    currency: enrollment.acceptedTerms.currency,
    dueDate: effectiveDue,
    installments,
    status: ChargeStatus.Pending,
  })
  await base.entities.studentCharges.save(charge)
  return charge
}
