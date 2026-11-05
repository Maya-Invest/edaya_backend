import type { OnboardingSchoolApplication } from './onboarding-application'
import { BusinessRuleViolationError } from '@edaya/core'

/** Technical dataset keys allocate opaque IDs inside the authorized onboarding transaction. */
export async function datasetEntityId(application: OnboardingSchoolApplication, schoolId: string, datasetId: string, kind: string, source: readonly (string | number)[]): Promise<string> {
  const key = JSON.stringify([datasetId, kind, ...source])
  return application.commandExecution.execute<string, { id: string }>({
    scope: { schoolId, command: 'bindOnboardingDatasetEntity', callerId: 'onboarding-dataset', requestId: key },
    input: { datasetId, kind, source },
    resultMode: 'ordinary',
    lockKeys: [`dataset-binding:${schoolId}`],
    authorize: async () => {
      if (!await application.repositories.schools.findById(schoolId))
        throw new BusinessRuleViolationError('SCHOOL_NOT_FOUND', 'School does not exist')
    },
    execute: async () => crypto.randomUUID(),
    audit: id => [{ event: 'onboarding.dataset.bound', resourceType: kind, resourceId: id }],
    persistResult: id => ({ id }),
    replay: async result => result.id,
  })
}
