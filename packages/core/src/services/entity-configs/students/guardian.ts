import type { Guardian } from '../../../entities/students/guardian'
import type { SchoolRepositories } from '../../../ports'
import type { EntityConfigFactory } from '../../../shared'
import { Permission } from '../../../authorization'
import { AttachmentOwnerKind } from '../../../entities/school/attachment'
import { directPermissionEntityConfig, readByIds } from '../../../shared'
import { BusinessRuleViolationError } from '../../../shared/business-rule-error'

export const guardianConfig: EntityConfigFactory<Guardian> = (input) => {
  const config = directPermissionEntityConfig(
    input,
    input.repositories.guardians,
    Permission.QUERY_GUARDIAN_STUDENTS_ADMIN_READ,
    Permission.PARENT_UPDATE,
    readByIds((actor, ids) => input.policy.checkGuardianAccess(actor, ids)),
  )
  return {
    ...config,
    gates: {
      preDelete: validateGuardianDelete,
    },
  }
}

async function validateGuardianDelete(
  guardian: Guardian,
  repositories: SchoolRepositories,
): Promise<void> {
  const [links, attachments] = await Promise.all([
    repositories.guardianLinks.list({ guardianId: guardian.id }),
    repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Guardian, ownerId: guardian.id }),
  ])
  if (links.length > 0 || attachments.length > 0) {
    throw new BusinessRuleViolationError('GUARDIAN_HAS_DEPENDENCIES', `Cannot delete guardian ${guardian.id}: dependent records still exist`)
  }
}
