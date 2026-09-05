import type { AnnouncementTarget } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { CommunicationsOperations, denyResourceAccess } from '@edaya/authorization'
import { AnnouncementStatus, AnnouncementTargetKind, BusinessRuleViolationError } from '@edaya/core'
import { config, noopDeleteAccess, noopReadAccess, noopSaveAccess, operationModule, read, write } from '../../entity-config'

import { announcementLinkedTenant } from '../../entity-config/tenant'
// Extracted from domain/messaging/announcement-target.ts (PR3)
export const announcementTargetConfig: EntityConfigFactory<AnnouncementTarget> = ({ repositories, atomicExecution }) =>
  config({
    repository: repositories.announcementTargets,
    tenant: announcementLinkedTenant('announcementId'),
    read: read(operationModule(CommunicationsOperations.read), noopReadAccess),
    write: write(operationModule(CommunicationsOperations.create), noopSaveAccess, noopDeleteAccess),
    gates: {
      preSave: validateAnnouncementTargetSave,
      preDelete: validateAnnouncementTargetDelete,
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

export async function validateAnnouncementTargetDelete(
  target: AnnouncementTarget,
  repositories: SchoolRepositories,
): Promise<void> {
  const announcement = await repositories.announcements.findById(target.announcementId)
  if (!announcement) {
    denyResourceAccess()
  }
  if (announcement.status !== AnnouncementStatus.Draft) {
    throw new BusinessRuleViolationError(
      'ANNOUNCEMENT_TARGET_NOT_DRAFT',
      `Cannot delete target ${target.id}: announcement ${target.announcementId} is not a draft`,
    )
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
