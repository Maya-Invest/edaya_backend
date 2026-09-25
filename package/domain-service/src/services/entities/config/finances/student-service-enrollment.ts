import type { StudentServiceEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver } from '../../entity-config'
import { BusinessRuleViolationError, ServiceEnrollmentStatus } from '@edaya/core'
import { assertSchoolCurrency } from '../../../../capabilities/finance/school-currency'
import { config } from '../../entity-config'
import { dateTime } from '../../entity-config/helper-utils'
import { indirectTenant } from '../../entity-config/tenant'

export const studentServiceEnrollmentConfig: EntityConfigFactory<StudentServiceEnrollment> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.studentServiceEnrollments,
    tenant: enrollmentTenant(),
    resource: 'studentServiceEnrollments',
    gates: {
      preSave: validateStudentServiceEnrollmentSave,
      preDelete: validateStudentServiceEnrollmentDelete,
    },
    atomicExecution,
  })

function enrollmentTenant(): EntityTenantResolver<StudentServiceEnrollment> {
  return indirectTenant(async entity => entity.schoolId)
}

export async function validateStudentServiceEnrollmentSave(
  entity: StudentServiceEnrollment,
  existing: StudentServiceEnrollment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await assertSchoolCurrency(repositories, entity.schoolId, entity.acceptedTerms.currency)
  if (!existing)
    return
  if (existing.schoolId !== entity.schoolId || existing.studentId !== entity.studentId || existing.catalogServiceId !== entity.catalogServiceId) {
    throw new BusinessRuleViolationError('ENROLLMENT_IDENTITY_LOCKED', `Enrollment ${existing.id} identity cannot change`)
  }
  if (JSON.stringify(existing.acceptedTerms.billingTerms) !== JSON.stringify(entity.acceptedTerms.billingTerms)
    || existing.acceptedTerms.price !== entity.acceptedTerms.price
    || existing.acceptedTerms.currency !== entity.acceptedTerms.currency) {
    throw new BusinessRuleViolationError('ENROLLMENT_TERMS_IMMUTABLE', `Enrollment ${existing.id} accepted terms cannot change`)
  }
  if (existing.status === ServiceEnrollmentStatus.Cancelled && cancellationChanged(entity, existing)) {
    throw new BusinessRuleViolationError('ALREADY_CANCELLED_ENROLLMENT', `Enrollment ${existing.id} has already been cancelled`)
  }
}

function cancellationChanged(entity: StudentServiceEnrollment, existing: StudentServiceEnrollment): boolean {
  return entity.cancellationReason !== existing.cancellationReason
    || entity.cancelledById !== existing.cancelledById
    || dateTime(entity.cancelledAt) !== dateTime(existing.cancelledAt)
}

async function validateStudentServiceEnrollmentDelete(): Promise<void> {
  throw new BusinessRuleViolationError('ENROLLMENT_DELETE_BLOCKED', 'Service enrollments cannot be deleted; cancel them instead')
}
