import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../authorization'
import { config, indirectTenant, permissionAction, read, unique, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { parseDomain, zodDate } from '../utils'
import { StudentStatus } from './student'
import { progressionDecisionChanged } from './student-note'
import { StudentClassEnrollmentStatus } from './student-class-enrollment-status'

export { StudentClassEnrollmentStatus } from './student-class-enrollment-status'

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

export const studentClassEnrollmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  enrollmentIndex: z.number().int().positive('enrollmentIndex must be a strictly positive integer'),
  status: z.nativeEnum(StudentClassEnrollmentStatus).default(StudentClassEnrollmentStatus.Active),
  enrolledAt: zodDate().optional(),
  endedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  endReason: z.nativeEnum(EnrollmentEndReason).nullable().optional().transform(v => v === null ? undefined : v),
  progressionDecision: z.nativeEnum(ProgressionDecision).nullable().optional().transform(v => v === null ? undefined : v),
  previousEnrollmentId: z.string().trim().min(1, 'previousEnrollmentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  closedBy: z.string().trim().min(1, 'closedBy must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  progressionDecidedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  progressionDecidedBy: z.string().trim().min(1, 'progressionDecidedBy must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  progressionNotes: z.string().trim().min(1, 'progressionNotes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineEnrollment(data: any, ctx: z.RefinementCtx) {
  const createdAt = data.createdAt ?? new Date()
  const enrolledAt = data.enrolledAt ?? createdAt

  if (data.status === StudentClassEnrollmentStatus.Active && (data.endedAt || data.endReason || data.closedBy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'active enrollments must not define closure information',
    })
  }
  if (data.status === StudentClassEnrollmentStatus.Closed && (!data.endedAt || !data.endReason || !data.closedBy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'closed enrollments must define endedAt, endReason, and closedBy',
    })
  }
  if (data.endedAt && data.endedAt.getTime() < enrolledAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endedAt must not be before enrolledAt',
    })
  }
  if (data.progressionDecision && (!data.progressionDecidedAt || !data.progressionDecidedBy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'progressionDecidedAt and progressionDecidedBy are required when a progression decision is recorded',
    })
  }
  if (!data.progressionDecision && (data.progressionDecidedAt || data.progressionDecidedBy || data.progressionNotes)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'progression metadata requires a progression decision',
    })
  }
  if (data.progressionDecision && data.endReason !== EnrollmentEndReason.Completed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'a progression decision requires a completed enrollment',
    })
  }
}

export const studentClassEnrollmentSchema = studentClassEnrollmentBaseSchema.superRefine(refineEnrollment)

export type StudentClassEnrollmentData = z.infer<typeof studentClassEnrollmentSchema>
export type StudentClassEnrollmentInput = z.input<typeof studentClassEnrollmentSchema>

export const studentClassEnrollmentCreateSchema = studentClassEnrollmentBaseSchema.omit({ createdAt: true }).superRefine(refineEnrollment)
export const studentClassEnrollmentUpdateSchema = studentClassEnrollmentBaseSchema.partial().required({ id: true }).superRefine((data, ctx) => {
  if (data.status === StudentClassEnrollmentStatus.Active && (data.endedAt || data.endReason || data.closedBy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'active enrollments must not define closure information',
    })
  }
  if (data.status === StudentClassEnrollmentStatus.Closed && (!data.endedAt || !data.endReason || !data.closedBy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'closed enrollments must define endedAt, endReason, and closedBy',
    })
  }
  if (data.enrolledAt && data.endedAt && data.endedAt.getTime() < data.enrolledAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'endedAt must not be before enrolledAt',
    })
  }
  if (data.progressionDecision && (!data.progressionDecidedAt || !data.progressionDecidedBy)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'progressionDecidedAt and progressionDecidedBy are required when a progression decision is recorded',
    })
  }
  if (!data.progressionDecision && (data.progressionDecidedAt || data.progressionDecidedBy || data.progressionNotes)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'progression metadata requires a progression decision',
    })
  }
  if (data.progressionDecision && data.endReason && data.endReason !== EnrollmentEndReason.Completed) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'a progression decision requires a completed enrollment',
    })
  }
})

/**
 * Records one placement in a class. Closing a placement and deciding the
 * student's next progression are separate facts.
 */
export class StudentClassEnrollment {
  readonly data: StudentClassEnrollmentData

  constructor(args: StudentClassEnrollmentInput) {
    const validated = parseDomain(studentClassEnrollmentSchema, args)
    this.data = {
      ...validated,
      enrolledAt: validated.enrolledAt ?? validated.createdAt,
    }
  }

  get id() { return this.data.id }
  get studentId() { return this.data.studentId }
  get classGroupId() { return this.data.classGroupId }
  get academicYearId() { return this.data.academicYearId }
  get enrollmentIndex() { return this.data.enrollmentIndex }
  get status() { return this.data.status }
  get enrolledAt() { return this.data.enrolledAt! }
  get endedAt() { return this.data.endedAt }
  get endReason() { return this.data.endReason }
  get progressionDecision() { return this.data.progressionDecision }
  get previousEnrollmentId() { return this.data.previousEnrollmentId }
  get closedBy() { return this.data.closedBy }
  get progressionDecidedAt() { return this.data.progressionDecidedAt }
  get progressionDecidedBy() { return this.data.progressionDecidedBy }
  get progressionNotes() { return this.data.progressionNotes }
  get createdAt() { return this.data.createdAt }

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
    read: read(permissionAction(Permission.QUERY_ENROLLMENT_HISTORY_READ), async (actor, entities) => {
      await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
    }),
    write: write(permissionAction(Permission.ENROLLMENT_CREATE), authorizeStudentLinked(policy), authorizeStudentLinkedDelete(policy)),
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
