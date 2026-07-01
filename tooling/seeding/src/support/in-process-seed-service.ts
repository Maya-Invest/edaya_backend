import type { SchoolService } from '@edaya/core'
import type { SeedApplication } from '../support/types'
import { createBootstrapStaffActorMetadata } from '@edaya/core'
import { SEED_SCHOOL_ID } from '@edaya/fixtures'

export function createInProcessSeedService(
  application: SeedApplication,
  requestId: string,
): SchoolService {
  return application.forActor(createBootstrapStaffActorMetadata({
    schoolId: SEED_SCHOOL_ID,
    requestId,
    staffMemberId: 'dev-seed',
  }))
}
