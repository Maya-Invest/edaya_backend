import type { SchoolService } from '@edaya/service'
import type { SeedApplication } from '../support/types'
import { createBootstrapStaffActorMetadata } from '@edaya/authorization'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'

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
