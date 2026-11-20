import type { School } from '@edaya/core'
import { BusinessRuleViolationError } from '@edaya/core'

/** Ownership invariants apply equally to commands, invitation claims and managed saves. */
export function validateSchoolOwnership(
  school: School,
  existing: School | undefined,
): void {
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
}
