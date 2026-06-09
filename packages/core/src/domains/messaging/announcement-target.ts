import type { SchoolRepositories } from '../../ports'
import type { EntityConfigFactory } from '../../shared'
import { denyResourceAccess, Permission } from '../../authorization'
import { announcementLinkedTenant, authorizeAnnouncementLinked, authorizeAnnouncementLinkedDelete, config, noopReadAccess, permissionAction, read, write } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank } from '../utils'

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

export interface AnnouncementTargetArgs {
  id: string
  announcementId: string
  targetKind: AnnouncementTargetKind
  targetId?: string | null
  createdAt?: Date
}

/**
 * Resolves a published or custom announcement to a concrete audience target.
 */
export class AnnouncementTarget {
  readonly id: string
  readonly announcementId: string
  readonly targetKind: AnnouncementTargetKind
  readonly targetId?: string
  readonly createdAt: Date

  constructor({ id, announcementId, targetKind, targetId, createdAt }: AnnouncementTargetArgs) {
    this.id = requireNonBlank(id, 'id')
    this.announcementId = requireNonBlank(announcementId, 'announcementId')
    this.targetKind = targetKind
    this.targetId = requireOptionalNonBlank(targetId, 'targetId')
    this.createdAt = createdAt ?? new Date()

    const isBroadcast = [
      AnnouncementTargetKind.School,
      AnnouncementTargetKind.AllStaff,
      AnnouncementTargetKind.AllGuardians,
      AnnouncementTargetKind.AllStudents,
    ].includes(this.targetKind)
    if (isBroadcast && this.targetId) {
      throw new Error('broadcast announcement targets must not define targetId')
    }
    if (!isBroadcast && !this.targetId) {
      throw new Error('scoped announcement targets must define targetId')
    }
  }
}

export const announcementTargetConfig: EntityConfigFactory<AnnouncementTarget> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.announcementTargets,
    tenant: announcementLinkedTenant('announcementId'),
    read: read(permissionAction(policy, Permission.QUERY_COMMUNICATIONS_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.COMMUNICATION_CREATE), authorizeAnnouncementLinked(policy, 'announcementId'), authorizeAnnouncementLinkedDelete(policy)),
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
