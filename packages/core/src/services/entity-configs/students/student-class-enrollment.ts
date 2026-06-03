import type { AuthorizationPolicy } from '../../../authorization'
import type { StudentClassEnrollment } from '../../../entities/students/student-class-enrollment'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../managed-entity-service'
import { denyResourceAccess } from '../../../authorization'
import { StudentStatus } from '../../../entities/students/student'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { action, config, indirectTenant, read, unique, write } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'
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
      preDelete: validateEnrollmentDelete,
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
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}

function authorizeStudentLinkedDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentClassEnrollment>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkStudentAccess(actor, [entity.studentId])
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}

export async function validateEnrollmentSave(
  entity: StudentClassEnrollment,
  existing: StudentClassEnrollment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [student, classGroup] = await Promise.all([
    repositories.students.findById(entity.studentId),
    repositories.classGroups.findById(entity.classGroupId),
  ])
  if (
    !student
    || !classGroup
    || student.schoolId !== classGroup.schoolId
    || entity.academicYearId !== classGroup.academicYearId
  ) {
    denyResourceAccess()
  }
  if (!existing && student.status !== StudentStatus.Active) {
    throw new BusinessRuleViolationError('STUDENT_NOT_ACTIVE', `Student ${entity.studentId} is not active and cannot be enrolled`)
  }
  if (existing && existing.studentId !== entity.studentId) {
    denyResourceAccess()
  }
  if (entity.status === StudentClassEnrollmentStatus.Active) {
    const activeEnrollments = await repositories.enrollments.list({
      studentId: entity.studentId,
      status: StudentClassEnrollmentStatus.Active,
    })
    const activeEnrollment = activeEnrollments.find(enrollment => enrollment.id !== entity.id)
    if (activeEnrollment && activeEnrollment.id !== entity.id) {
      throw new BusinessRuleViolationError('STUDENT_ALREADY_ENROLLED', `Student ${entity.studentId} already has an active class enrollment`)
    }
    if (classGroup.capacity !== undefined) {
      const activeClassEnrollments = await repositories.enrollments.list({
        classGroupId: classGroup.id,
        status: StudentClassEnrollmentStatus.Active,
      })
      const activeEnrollmentCount = activeClassEnrollments.length
      const existingCountsTowardCapacity = existing?.classGroupId === classGroup.id
        && existing.status === StudentClassEnrollmentStatus.Active
      const proposedActiveCount = activeEnrollmentCount + (existingCountsTowardCapacity ? 0 : 1)
      if (proposedActiveCount > classGroup.capacity) {
        throw new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_EXCEEDED', `Class group ${classGroup.id} has reached its enrollment capacity`)
      }
    }
  }

  if (existing) {
    const closesActiveEnrollment = existing.status === StudentClassEnrollmentStatus.Active
      && entity.status === StudentClassEnrollmentStatus.Closed
    if (closesActiveEnrollment) {
      const activeEnrollments = await repositories.enrollments.list({
        studentId: existing.studentId,
        status: StudentClassEnrollmentStatus.Active,
      })
      const activeEnrollment = activeEnrollments[0]
      if (activeEnrollment?.id !== existing.id) {
        throw new BusinessRuleViolationError('ENROLLMENT_NOT_ACTIVE', `Enrollment ${existing.id} is not the student's active enrollment`)
      }
    }

    if (existing.progressionDecision && progressionDecisionChanged(entity, existing)) {
      throw new BusinessRuleViolationError('PROGRESSION_DECISION_ALREADY_RECORDED', `Enrollment ${existing.id} already has a progression decision`)
    }
  }
}

async function validateEnrollmentDelete(
  entity: StudentClassEnrollment,
): Promise<void> {
  if (entity.status === StudentClassEnrollmentStatus.Active) {
    throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_DELETE_BLOCKED', `Enrollment ${entity.id} is active and cannot be deleted`)
  }
  if (entity.progressionDecision) {
    throw new BusinessRuleViolationError('ENROLLMENT_WITH_PROGRESSION_DELETE_BLOCKED', `Enrollment ${entity.id} has a progression decision and cannot be deleted`)
  }
}
