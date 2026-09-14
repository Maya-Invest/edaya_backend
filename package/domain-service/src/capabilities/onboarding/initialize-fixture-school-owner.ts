import type { ResourceAccessScope } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { BusinessRuleViolationError, School } from '@edaya/core'
import { schoolCommandScope } from '../../services/commands/school-command-scope'
import { validateSchoolOwnership } from '../../services/entities/config/school/validate-school-ownership'

/** Internal fixture admission only; never exposed as a school HTTP/GraphQL command. */
export async function initializeFixtureSchoolOwner(base: BaseSchoolService, input: { schoolId: string, staffId: string, subjectId: string }): Promise<void> {
  for (const value of [input.schoolId, input.staffId, input.subjectId]) {
    if (typeof value !== 'string' || !value.trim() || value !== value.trim())
      throw new BusinessRuleViolationError('FIXTURE_OWNER_INPUT_INVALID', 'Fixture owner identifiers must be nonempty and canonical')
  }
  let proposed: School
  let scope: ResourceAccessScope
  await base.commandExecution.execute({
    scope: await schoolCommandScope(base.actor, 'initializeFixtureSchoolOwner', input.schoolId),
    input,
    resultMode: 'ordinary',
    lockKeys: [`school-owner:${input.subjectId}`, `school-owner-initialization:${input.schoolId}`],
    authorize: async () => {
      if (input.schoolId !== base.actor.schoolId)
        denyResourceAccess()
      const existing = await base.repositories.schools.forSchool!(base.actor.schoolId).findById(input.schoolId)
      if (!existing)
        denyResourceAccess()
      proposed = new School({ ...existing.data, ownerSubjectId: input.subjectId })
      scope = await base.access.identities.assertInitializeFixtureOwner(input.staffId, existing, proposed)
      await validateSchoolOwnership(proposed, existing, base.repositories)
    },
    execute: async () => {
      await base.repositories.schools.forAccess(scope).save(proposed)
      return { schoolId: input.schoolId, staffId: input.staffId }
    },
    replay: async (stored: { schoolId: string, staffId: string }) => {
      if (stored.schoolId !== input.schoolId || stored.staffId !== input.staffId
        || (await base.repositories.schools.forSchool!(base.actor.schoolId).findById(input.schoolId))?.ownerSubjectId !== input.subjectId) {
        denyResourceAccess()
      }
      return stored
    },
    persistResult: result => ({ schoolId: result.schoolId, staffId: result.staffId }),
    audit: result => [{ event: 'school.fixture_owner_initialized', resourceType: 'school', resourceId: result.schoolId }],
  })
}
