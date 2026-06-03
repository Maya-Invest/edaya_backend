import type { StudentClassEnrollment } from '../../../../entities/students/student-class-enrollment'
import type { SchoolRepositories } from '../../../../ports'
import type { AuthorizationPolicy } from '../../../authorization'
import type { EntityConfigFactory } from '../../../shared/common'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { StudentClassEnrollmentStatus } from '../../../../entities/students/student-class-enrollment'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
import { action, config, indirectTenant, read, unique, write } from '../../../shared/common'
import { progressionDecisionChanged } from './student-note'

export const studentClassEnrollmentConfig: EntityConfigFactory<StudentClassEnrollment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.enrollments,
    tenant: studentLinkedTenant(),
    read: read(action(policy, 'queries.read_enrollment_history'), async (actor, entities) => {
      await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    }),
    write: write(action(policy, 'students.manage_enrollment'), authorizeStudentLinked(policy), authorizeStudentLinkedDelete(policy)),
    gates: {
      preSave: validateEnrollmentSave,
    },
    atomicExecution,
  })

function studentLinkedTenant(): EntityTenantResolver<StudentClassEnrollment> {
  return indirectTenant(async (entity, repositories) => {
    const student = await repositories.students.findById(entity.studentId)
    return student?.schoolId
  })
}

function authorizeStudentLinked(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentClassEnrollment>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeStudentLinkedDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentClassEnrollment>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

export async function validateEnrollmentSave(
  entity: StudentClassEnrollment,
  existing: StudentClassEnrollment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!existing)
    return

  const closesActiveEnrollment = existing.status === StudentClassEnrollmentStatus.Active
    && entity.status === StudentClassEnrollmentStatus.Closed
  if (closesActiveEnrollment) {
    const activeEnrollment = await repositories.enrollments.findOne({
      studentId: existing.studentId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (activeEnrollment?.id !== existing.id) {
      throw new BusinessRuleViolationError('ENROLLMENT_NOT_ACTIVE', `Enrollment ${existing.id} is not the student's active enrollment`)
    }
  }

  if (existing.progressionDecision && progressionDecisionChanged(entity, existing)) {
    throw new BusinessRuleViolationError('PROGRESSION_DECISION_ALREADY_RECORDED', `Enrollment ${existing.id} already has a progression decision`)
  }
}
