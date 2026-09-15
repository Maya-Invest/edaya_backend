import type { School } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import { BusinessRuleViolationError } from '@edaya/core'

/** Ownership invariants apply equally to commands, invitation claims and managed saves. */
export async function validateSchoolOwnership(
  school: School,
  existing: School | undefined,
  repositories: Pick<SchoolRepositories, 'schools'>,
): Promise<void> {
  if (existing && (
    school.logoAttachmentId !== existing.logoAttachmentId
    || school.crestAttachmentId !== existing.crestAttachmentId
    || school.stampAttachmentId !== existing.stampAttachmentId
    || school.signatureAttachmentId !== existing.signatureAttachmentId
    || school.issuanceAssetVersion !== existing.issuanceAssetVersion
  )) {
    throw new BusinessRuleViolationError(
      'SCHOOL_ISSUANCE_ASSETS_COMMAND_OWNED',
      'Issuance assets must be changed through named upload or clear commands',
    )
  }
  if (existing?.ownerSubjectId && !school.ownerSubjectId)
    throw new BusinessRuleViolationError('SCHOOL_OWNER_REQUIRED', 'Transfer school ownership instead of removing the owner')
  if (!school.ownerSubjectId || school.ownerSubjectId === existing?.ownerSubjectId)
    return
  const ownedSchool = await repositories.schools.findOne({ ownerSubjectId: school.ownerSubjectId, id: { $ne: school.id } })
  if (ownedSchool)
    throw new BusinessRuleViolationError('OWNER_SUBJECT_ALREADY_ASSIGNED', 'This account already owns another school')
}
