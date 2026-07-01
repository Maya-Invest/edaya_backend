import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import type { EntityConfigFactory } from '../../application/entities/entity-config'
import { z } from 'zod'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { authorizeClassGroupLinked, authorizeClassGroupLinkedDelete, classGroupLinkedTenant, config, permissionAction, read, readByIds, write } from '../../application/entities/entity-config'
import { parseDomain, zodDate } from '../shared/utils'

export enum HomeworkAssignmentType {
  Homework = 'homework',
  Project = 'project',
  Reading = 'reading',
  Lab = 'lab',
}

export const homeworkAttachmentSchema = z.object({
  name: z.string().trim().min(1, 'attachment name must not be blank'),
  size: z.string().trim().min(1, 'attachment size must not be blank'),
})

export type HomeworkAttachment = z.infer<typeof homeworkAttachmentSchema>

export const homeworkAssignmentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  description: z.string().trim().min(1, 'description must not be blank'),
  dueDate: zodDate(),
  assignedDate: zodDate(),
  type: z.nativeEnum(HomeworkAssignmentType),
  attachments: z.array(homeworkAttachmentSchema).default([]),
  createdAt: zodDate().default(() => new Date()),
})

function refineHomeworkAssignment(data: any, ctx: z.RefinementCtx) {
  if (data.assignedDate.getTime() > data.dueDate.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'assignedDate must not be after dueDate',
    })
  }
}

export const homeworkAssignmentSchema = homeworkAssignmentBaseSchema.superRefine(refineHomeworkAssignment)

export type HomeworkAssignmentData = z.infer<typeof homeworkAssignmentSchema>
export type HomeworkAssignmentInput = z.input<typeof homeworkAssignmentSchema>

export const homeworkAssignmentCreateSchema = homeworkAssignmentBaseSchema.omit({ createdAt: true }).superRefine(refineHomeworkAssignment)
export const homeworkAssignmentUpdateSchema = homeworkAssignmentBaseSchema.partial().required({ id: true }).superRefine(refineHomeworkAssignment)

/**
 * Homework or project assigned to a class subject, with optional file attachments.
 */
export class HomeworkAssignment {
  readonly data: HomeworkAssignmentData

  constructor(args: HomeworkAssignmentInput) {
    this.data = parseDomain(homeworkAssignmentSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get classGroupId() { return this.data.classGroupId }
  get classSubjectId() { return this.data.classSubjectId }
  get title() { return this.data.title }
  get description() { return this.data.description }
  get dueDate() { return this.data.dueDate }
  get assignedDate() { return this.data.assignedDate }
  get type() { return this.data.type }
  get attachments() { return this.data.attachments }
  get createdAt() { return this.data.createdAt }
}

export const homeworkAssignmentConfig: EntityConfigFactory<HomeworkAssignment> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.homeworkAssignments,
    tenant: classGroupLinkedTenant('classGroupId'),
    read: read(
      permissionAction(Permission.CLASS_LOGBOOK_READ),
      readByIds(async (actor, ids) => {
        const assignments = await repositories.homeworkAssignments.findByIds(ids)
        await policy.checkClassGroupAccess(actor, assignments.map(assignment => assignment.classGroupId))
      }),
    ),
    write: write(
      permissionAction(Permission.CLASS_LOGBOOK_UPDATE),
      authorizeClassGroupLinked(policy, 'classGroupId'),
      authorizeClassGroupLinkedDelete(policy),
    ),
    gates: {
      preSave: validateHomeworkAssignmentSave,
    },
    atomicExecution,
  })

async function validateHomeworkAssignmentSave(
  assignment: HomeworkAssignment,
  _existing: HomeworkAssignment | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const [classGroup, classSubject] = await Promise.all([
    repositories.classGroups.findById(assignment.classGroupId),
    repositories.classSubjects.findById(assignment.classSubjectId),
  ])

  if (
    !classGroup
    || !classSubject
    || classSubject.classGroupId !== classGroup.id
    || classGroup.schoolId !== assignment.schoolId
  ) {
    denyResourceAccess()
  }
}
