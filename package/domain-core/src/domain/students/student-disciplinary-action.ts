import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { config, directSchoolTenant, noopReadAccess, operationModule, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, DisciplineOperations } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { refineEndsAtNotBeforeStartsAtOptional } from '../../domain/value-objects/date-time-range'
import { parseDomain, zodDate } from '../shared/utils'

export enum StudentDisciplinaryActionStatus {
  Active = 'active',
  Completed = 'completed',
  Cancelled = 'cancelled',
}

export const studentDisciplinaryActionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  incidentId: z.string().trim().min(1, 'incidentId must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  disciplinaryActionId: z.string().trim().min(1, 'disciplinaryActionId must not be blank'),
  assignedByStaffId: z.string().trim().min(1, 'assignedByStaffId must not be blank'),
  startsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  endsAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(StudentDisciplinaryActionStatus).default(StudentDisciplinaryActionStatus.Active),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

function refineStudentDisciplinaryAction(data: any, ctx: z.RefinementCtx) {
  refineEndsAtNotBeforeStartsAtOptional(data, ctx)
  if (data.updatedAt.getTime() < data.createdAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'updatedAt must not be before createdAt',
    })
  }
}

export const studentDisciplinaryActionSchema = studentDisciplinaryActionBaseSchema.superRefine(refineStudentDisciplinaryAction)

export type StudentDisciplinaryActionData = z.infer<typeof studentDisciplinaryActionSchema>
export type StudentDisciplinaryActionInput = z.input<typeof studentDisciplinaryActionSchema>

export const studentDisciplinaryActionCreateSchema = studentDisciplinaryActionBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineStudentDisciplinaryAction)
export const studentDisciplinaryActionUpdateSchema = studentDisciplinaryActionBaseSchema.partial().required({ id: true }).superRefine(refineStudentDisciplinaryAction)

/**
 * Represents a disciplinary catalog action actually applied to a student.
 */
export class StudentDisciplinaryAction {
  readonly data: StudentDisciplinaryActionData

  constructor(args: StudentDisciplinaryActionInput) {
    this.data = parseDomain(studentDisciplinaryActionSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get incidentId() { return this.data.incidentId }
  get studentId() { return this.data.studentId }
  get disciplinaryActionId() { return this.data.disciplinaryActionId }
  get assignedByStaffId() { return this.data.assignedByStaffId }
  get startsAt() { return this.data.startsAt }
  get endsAt() { return this.data.endsAt }
  get status() { return this.data.status }
  get notes() { return this.data.notes }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}

export const studentDisciplinaryActionConfig: EntityConfigFactory<StudentDisciplinaryAction> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.studentDisciplinaryActions,
    tenant: directSchoolTenant(),
    read: read(operationModule(DisciplineOperations.read), noopReadAccess),
    write: write(operationModule(DisciplineOperations.validate), authorizeStudentDisciplinaryAction(policy), authorizeStudentDisciplinaryActionDelete(policy)),
    gates: {
      preSave: validateStudentDisciplinaryActionSave,
      preDelete: validateStudentDisciplinaryActionDelete,
    },
    atomicExecution,
  })

function authorizeStudentDisciplinaryAction(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentDisciplinaryAction>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    if (existing && entity.status !== existing.status && existing.status !== StudentDisciplinaryActionStatus.Active) {
      return
    }
    const incident = await repositories.incidents.findById(entity.incidentId)
    if (!incident) {
      denyResourceAccess()
    }
    if (incident.classGroupId)
      await policy.checkClassGroupAccess(actor, [incident.classGroupId])
    if (incident.lessonSessionId)
      await policy.checkLessonSessionAccess(actor, [incident.lessonSessionId])
    await policy.checkStudentAccess(actor, [entity.studentId])
  }
}

function authorizeStudentDisciplinaryActionDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<StudentDisciplinaryAction>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    await authorizeStudentDisciplinaryAction(policy)(actor, entity, entity, repositories)
  }
}

async function validateStudentDisciplinaryActionSave(
  entity: StudentDisciplinaryAction,
  existing: StudentDisciplinaryAction | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (existing && entity.status !== existing.status && existing.status !== StudentDisciplinaryActionStatus.Active) {
    throw new BusinessRuleViolationError('DISCIPLINARY_ACTION_STATUS_FINAL', `Disciplinary action ${existing.id} status cannot be changed from ${existing.status}`)
  }
  const [incident, student, catalogAction, involvement] = await Promise.all([
    repositories.incidents.findById(entity.incidentId),
    repositories.students.findById(entity.studentId),
    repositories.disciplinaryActions.findById(entity.disciplinaryActionId),
    repositories.studentIncidentInvolvements.list({
      incidentId: entity.incidentId,
      studentId: entity.studentId,
    }),
  ])
  if (
    !incident
    || !student
    || !catalogAction
    || involvement.length === 0
    || incident.schoolId !== entity.schoolId
    || student.schoolId !== entity.schoolId
    || catalogAction.schoolId !== entity.schoolId
  ) {
    denyResourceAccess()
  }
  if (existing && (
    existing.schoolId !== entity.schoolId
    || existing.incidentId !== entity.incidentId
    || existing.studentId !== entity.studentId
    || existing.disciplinaryActionId !== entity.disciplinaryActionId
  )) {
    denyResourceAccess()
  }
}

async function validateStudentDisciplinaryActionDelete(
  entity: StudentDisciplinaryAction,
): Promise<void> {
  if (entity.status !== StudentDisciplinaryActionStatus.Active) {
    throw new BusinessRuleViolationError('DISCIPLINARY_ACTION_STATUS_FINAL', `Disciplinary action ${entity.id} status cannot be deleted from ${entity.status}`)
  }
}
