import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, indirectTenant, permissionAction, read, unique, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt, requireValidDate } from '../utils'
import { StudentStatus } from './student'
import { progressionDecisionChanged } from './student-note'

export enum StudentClassEnrollmentStatus {
  Active = 'active',
  Closed = 'closed',
}

export enum EnrollmentEndReason {
  Completed = 'completed',
  Transferred = 'transferred',
  Withdrawn = 'withdrawn',
}

export enum ProgressionDecision {
  Promoted = 'promoted',
  Retained = 'retained',
  Graduated = 'graduated',
}

export interface StudentClassEnrollmentArgs {
  id: string
  studentId: string
  classGroupId: string
  academicYearId: string
  enrollmentIndex: number
  status?: StudentClassEnrollmentStatus
  enrolledAt?: Date
  endedAt?: Date | null
  endReason?: EnrollmentEndReason | null
  progressionDecision?: ProgressionDecision | null
  previousEnrollmentId?: string | null
  closedBy?: string | null
  progressionDecidedAt?: Date | null
  progressionDecidedBy?: string | null
  progressionNotes?: string | null
  createdAt?: Date
}

/**
 * Records one placement in a class. Closing a placement and deciding the
 * student's next progression are separate facts.
 */
export class StudentClassEnrollment {
  readonly id: string
  readonly studentId: string
  readonly classGroupId: string
  readonly academicYearId: string
  readonly enrollmentIndex: number
  readonly status: StudentClassEnrollmentStatus
  readonly enrolledAt: Date
  readonly endedAt?: Date
  readonly endReason?: EnrollmentEndReason
  readonly progressionDecision?: ProgressionDecision
  readonly previousEnrollmentId?: string
  readonly closedBy?: string
  readonly progressionDecidedAt?: Date
  readonly progressionDecidedBy?: string
  readonly progressionNotes?: string
  readonly createdAt: Date

  constructor({
    id,
    studentId,
    classGroupId,
    academicYearId,
    enrollmentIndex,
    status = StudentClassEnrollmentStatus.Active,
    enrolledAt,
    endedAt,
    endReason,
    progressionDecision,
    previousEnrollmentId,
    closedBy,
    progressionDecidedAt,
    progressionDecidedBy,
    progressionNotes,
    createdAt,
  }: StudentClassEnrollmentArgs) {
    const now = new Date()
    this.id = requireNonBlank(id, 'id')
    this.studentId = requireNonBlank(studentId, 'studentId')
    this.classGroupId = requireNonBlank(classGroupId, 'classGroupId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.enrollmentIndex = requirePositiveInt(enrollmentIndex, 'enrollmentIndex')
    this.status = status
    this.createdAt = createdAt ? requireValidDate(createdAt, 'createdAt') : now
    this.enrolledAt = enrolledAt ? requireValidDate(enrolledAt, 'enrolledAt') : this.createdAt
    this.endedAt = endedAt ? requireValidDate(endedAt, 'endedAt') : undefined
    this.endReason = endReason ?? undefined
    this.progressionDecision = progressionDecision ?? undefined
    this.previousEnrollmentId = requireOptionalNonBlank(previousEnrollmentId, 'previousEnrollmentId')
    this.closedBy = requireOptionalNonBlank(closedBy, 'closedBy')
    this.progressionDecidedAt = progressionDecidedAt
      ? requireValidDate(progressionDecidedAt, 'progressionDecidedAt')
      : undefined
    this.progressionDecidedBy = requireOptionalNonBlank(progressionDecidedBy, 'progressionDecidedBy')
    this.progressionNotes = requireOptionalNonBlank(progressionNotes, 'progressionNotes')

    if (this.status === StudentClassEnrollmentStatus.Active && (this.endedAt || this.endReason || this.closedBy)) {
      throw new Error('active enrollments must not define closure information')
    }
    if (this.status === StudentClassEnrollmentStatus.Closed && (!this.endedAt || !this.endReason || !this.closedBy)) {
      throw new Error('closed enrollments must define endedAt, endReason, and closedBy')
    }
    if (this.endedAt && this.endedAt.getTime() < this.enrolledAt.getTime()) {
      throw new Error('endedAt must not be before enrolledAt')
    }
    if (this.progressionDecision && (!this.progressionDecidedAt || !this.progressionDecidedBy)) {
      throw new Error('progressionDecidedAt and progressionDecidedBy are required when a progression decision is recorded')
    }
    if (!this.progressionDecision && (this.progressionDecidedAt || this.progressionDecidedBy || this.progressionNotes)) {
      throw new Error('progression metadata requires a progression decision')
    }
    if (this.progressionDecision && this.endReason !== EnrollmentEndReason.Completed) {
      throw new Error('a progression decision requires a completed enrollment')
    }
  }

  close({
    endedAt,
    endReason,
    closedBy,
  }: {
    endedAt: Date
    endReason: EnrollmentEndReason
    closedBy: string
  }): StudentClassEnrollment {
    if (this.status !== StudentClassEnrollmentStatus.Active) {
      throw new Error(`Enrollment ${this.id} is already closed`)
    }
    return new StudentClassEnrollment({
      id: this.id,
      studentId: this.studentId,
      classGroupId: this.classGroupId,
      academicYearId: this.academicYearId,
      enrollmentIndex: this.enrollmentIndex,
      status: StudentClassEnrollmentStatus.Closed,
      enrolledAt: this.enrolledAt,
      endedAt,
      endReason,
      previousEnrollmentId: this.previousEnrollmentId,
      closedBy,
      createdAt: this.createdAt,
    })
  }

  recordProgressionDecision({
    decision,
    decidedAt,
    decidedBy,
    notes,
  }: {
    decision: ProgressionDecision
    decidedAt: Date
    decidedBy: string
    notes?: string
  }): StudentClassEnrollment {
    if (this.progressionDecision) {
      throw new Error(`Enrollment ${this.id} already has a progression decision`)
    }
    return new StudentClassEnrollment({
      id: this.id,
      studentId: this.studentId,
      classGroupId: this.classGroupId,
      academicYearId: this.academicYearId,
      enrollmentIndex: this.enrollmentIndex,
      status: this.status,
      enrolledAt: this.enrolledAt,
      endedAt: this.endedAt,
      endReason: this.endReason,
      previousEnrollmentId: this.previousEnrollmentId,
      closedBy: this.closedBy,
      progressionDecision: decision,
      progressionDecidedAt: decidedAt,
      progressionDecidedBy: decidedBy,
      progressionNotes: notes,
      createdAt: this.createdAt,
    })
  }
}

export const studentClassEnrollmentConfig: EntityConfigFactory<StudentClassEnrollment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.enrollments,
    tenant: studentLinkedTenant(),
    read: read(permissionAction(policy, Permission.QUERY_ENROLLMENT_HISTORY_READ), async (actor, entities) => {
      await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    }),
    write: write(permissionAction(policy, Permission.ENROLLMENT_CREATE), authorizeStudentLinked(policy), authorizeStudentLinkedDelete(policy)),
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
