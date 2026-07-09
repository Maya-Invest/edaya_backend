import type { Guardian } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'
import { GuardianOperations } from '@edaya/authorization'
import { AttachmentOwnerKind, BusinessRuleViolationError } from '@edaya/core'
import { authorizeDeleteByReadAccess, authorizeExistingById, config, operationModule, read, readByIds, write } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'

// Extracted from domain/students/guardian.ts (PR3)
export const guardianConfig: EntityConfigFactory<Guardian> = ({ repositories, policy, atomicExecution }) => {
  const readAccess = readByIds((actor, ids) => policy.checkGuardianAccess(actor, ids))

  return config({
    repository: repositories.guardians,
    tenant: directSchoolTenant(),
    read: read(operationModule(GuardianOperations.read), readAccess),
    write: write(
      operationModule(GuardianOperations.update),
      authorizeExistingById(readAccess),
      authorizeDeleteByReadAccess(readAccess),
    ),
    gates: {
      preDelete: validateGuardianDelete,
    },
    atomicExecution,
  })
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
