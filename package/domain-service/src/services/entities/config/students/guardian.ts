import type { Guardian } from '@edaya/core'
import type { SchoolRepositories } from '../../../../ports/school-repositories'
import type { EntityConfigFactory } from '../../entity-config'

import { AttachmentOwnerKind, BusinessRuleViolationError } from '@edaya/core'
import { config } from '../../entity-config'
import { directSchoolTenant } from '../../entity-config/tenant'
import { assertUniquePersonCode } from '../person-code-uniqueness'

// Extracted from domain/students/guardian.ts (PR3)
export const guardianConfig: EntityConfigFactory<Guardian> = ({ repositories, atomicExecution }) => {
  return {
    ...config({
      repository: repositories.guardians,
      tenant: directSchoolTenant(),
      resource: 'guardians',

      atomicExecution,
    }),
    gates: {
      preSave: validateGuardianSave,
      preDelete: validateGuardianDelete,
    },
  }
}

async function validateGuardianSave(
  guardian: Guardian,
  _existing: Guardian | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await assertUniquePersonCode({
    code: guardian.code,
    schoolId: guardian.schoolId,
    entityId: guardian.id,
    errorCode: 'GUARDIAN_CODE_ALREADY_EXISTS',
    entityLabel: 'Guardian',
    listBySchool: () => repositories.guardians.list({ schoolId: guardian.schoolId }),
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
