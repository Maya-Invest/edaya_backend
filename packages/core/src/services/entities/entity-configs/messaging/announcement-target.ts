import type { AnnouncementTarget } from '../../../../entities/messaging/announcement-target'
import type { SchoolRepositories } from '../../../../ports'
import type { EntityConfigFactory } from '../../../shared/common'
import { AnnouncementTargetKind } from '../../../../entities/messaging/announcement-target'
import { denyResourceAccess } from '../../../authorization'
import { action, announcementLinkedTenant, authorizeAnnouncementLinked, authorizeAnnouncementLinkedDelete, config, noopReadAccess, read, write } from '../../../shared/common'

export const announcementTargetConfig: EntityConfigFactory<AnnouncementTarget> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.announcementTargets,
    tenant: announcementLinkedTenant('announcementId'),
    read: read(action(policy, 'queries.read_communications'), noopReadAccess),
    write: write(action(policy, 'communications.manage'), authorizeAnnouncementLinked(policy, 'announcementId'), authorizeAnnouncementLinkedDelete(policy)),
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
