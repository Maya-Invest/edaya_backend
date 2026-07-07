import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { announcementLinkedTenant, config, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../application/entities/entity-config'
import { CommunicationsOperations, denyResourceAccess } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

export enum AnnouncementTargetKind {
  School = 'school',
  AllStaff = 'all_staff',
  AllGuardians = 'all_guardians',
  AllStudents = 'all_students',
  ClassGroup = 'class_group',
  GradeLevel = 'grade_level',
  StaffMember = 'staff_member',
  Guardian = 'guardian',
  Student = 'student',
}

export const announcementTargetBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  announcementId: z.string().trim().min(1, 'announcementId must not be blank'),
  targetKind: z.nativeEnum(AnnouncementTargetKind),
  targetId: z.string().trim().min(1, 'targetId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineAnnouncementTarget(data: any, ctx: z.RefinementCtx) {
  const isBroadcast = [
    AnnouncementTargetKind.School,
    AnnouncementTargetKind.AllStaff,
    AnnouncementTargetKind.AllGuardians,
    AnnouncementTargetKind.AllStudents,
  ].includes(data.targetKind)
  if (isBroadcast && data.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'broadcast announcement targets must not define targetId',
    })
  }
  if (!isBroadcast && !data.targetId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'scoped announcement targets must define targetId',
    })
  }
}

export const announcementTargetSchema = announcementTargetBaseSchema.superRefine(refineAnnouncementTarget)

export type AnnouncementTargetData = z.infer<typeof announcementTargetSchema>
export type AnnouncementTargetInput = z.input<typeof announcementTargetSchema>

export const announcementTargetCreateSchema = announcementTargetBaseSchema.omit({ createdAt: true }).superRefine(refineAnnouncementTarget)
export const announcementTargetUpdateSchema = announcementTargetBaseSchema.partial().required({ id: true }).superRefine(refineAnnouncementTarget)

/**
 * Resolves a published or custom announcement to a concrete audience target.
 */
export class AnnouncementTarget {
  readonly data: AnnouncementTargetData

  constructor(args: AnnouncementTargetInput) {
    this.data = parseDomain(announcementTargetSchema, args)
  }

  get id() { return this.data.id }
  get announcementId() { return this.data.announcementId }
  get targetKind() { return this.data.targetKind }
  get targetId() { return this.data.targetId }
  get createdAt() { return this.data.createdAt }
}

export const announcementTargetConfig: EntityConfigFactory<AnnouncementTarget> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.announcementTargets,
    tenant: announcementLinkedTenant('announcementId'),
    read: read(operationModule(CommunicationsOperations.read), noopReadAccess),
    write: write(operationModule(CommunicationsOperations.create), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateAnnouncementTargetSave,
    },
    atomicExecution,
  })

export async function validateAnnouncementTargetSave(
  target: AnnouncementTarget,
  _existing: AnnouncementTarget | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const announcement = await repositories.announcements.findById(target.announcementId)
  if (!announcement) {
    denyResourceAccess()
  }
  if (!target.targetId) {
    return
  }
  switch (target.targetKind) {
    case AnnouncementTargetKind.ClassGroup:
      await requireOwnedResource(repositories.classGroups.findById(target.targetId), announcement.schoolId)
      break
    case AnnouncementTargetKind.GradeLevel:
      await requireOwnedResource(repositories.gradeLevels.findById(target.targetId), announcement.schoolId)
      break
    case AnnouncementTargetKind.StaffMember:
      await requireOwnedResource(repositories.staffMembers.findById(target.targetId), announcement.schoolId)
      break
    case AnnouncementTargetKind.Guardian:
      await requireOwnedResource(repositories.guardians.findById(target.targetId), announcement.schoolId)
      break
    case AnnouncementTargetKind.Student:
      await requireOwnedResource(repositories.students.findById(target.targetId), announcement.schoolId)
      break
    case AnnouncementTargetKind.School:
    case AnnouncementTargetKind.AllStaff:
    case AnnouncementTargetKind.AllGuardians:
    case AnnouncementTargetKind.AllStudents:
      break
  }
}

async function requireOwnedResource<T extends { schoolId: string }>(
  resourcePromise: Promise<T | undefined>,
  schoolId: string,
): Promise<void> {
  const resource = await resourcePromise
  if (!resource || resource.schoolId !== schoolId) {
    denyResourceAccess()
  }
}
