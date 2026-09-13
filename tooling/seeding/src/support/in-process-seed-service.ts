import type { SchoolService } from '@edaya/service'
import type { SeedApplication } from '../support/types'
import { createSystemActorMetadata } from '@edaya/authorization'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'

export function createInProcessSeedService(
  application: SeedApplication,
  requestId: string,
): SchoolService {
  return application.forActor(createSystemActorMetadata({
    schoolId: SEED_SCHOOL_ID,
    requestId,
    systemId: 'fixture-seed',
    reason: 'Install the selected local development dataset',
  }))
}
