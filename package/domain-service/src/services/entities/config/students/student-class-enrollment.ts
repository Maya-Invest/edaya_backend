import type { AuthorizationPolicy } from '@edaya/authorization'
import type { StudentClassEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory, EntityTenantResolver, EntityWriteAuthorization } from '../../entity-config'
import { denyResourceAccess, EnrollmentOperations } from '@edaya/authorization'
import { BusinessRuleViolationError, StudentClassEnrollmentStatus, StudentStatus } from '@edaya/core'
import { config, operationModule, read, write } from '../../entity-config'
import { dateTime, unique } from '../../entity-config/helper-utils'
import { indirectTenant } from '../../entity-config/tenant'

// Extracted from domain/students/student-class-enrollment.ts (PR3)
export const studentClassEnrollmentConfig: EntityConfigFactory<StudentClassEnrollment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.enrollments,
    tenant: studentLinkedTenant(),
    read: read(operationModule(EnrollmentOperations.read), async (actor, entities) => {
      await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    }),
    write: write(operationModule(EnrollmentOperations.create), authorizeStudentLinked(policy), authorizeStudentLinkedDelete(policy)),
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

function progressionDecisionChanged(
  entity: StudentClassEnrollment,
  existing: StudentClassEnrollment,
): boolean {
  return entity.progressionDecision !== existing.progressionDecision
    || dateTime(entity.progressionDecidedAt) !== dateTime(existing.progressionDecidedAt)
    || entity.progressionDecidedBy !== existing.progressionDecidedBy
    || entity.progressionNotes !== existing.progressionNotes
}
