import type { EntityStores } from './entity-stores-types'
import { createAcademicsEntityStores } from './entity-stores-academics'
import { createAssessmentsEntityStores } from './entity-stores-assessments'
import { createFinancesEntityStores } from './entity-stores-finances'
import { createMessagingEntityStores } from './entity-stores-messaging'
import { createSchedulingEntityStores } from './entity-stores-scheduling'
import { createSchoolEntityStores } from './entity-stores-school'
import { createStudentsEntityStores } from './entity-stores-students'

export type { EntityStores } from './entity-stores-types'

export function createEntityStores(db: any): EntityStores {
  return {
    ...createSchoolEntityStores(db),
    ...createAcademicsEntityStores(db),
    ...createStudentsEntityStores(db),
    ...createSchedulingEntityStores(db),
    ...createAssessmentsEntityStores(db),
    ...createFinancesEntityStores(db),
    ...createMessagingEntityStores(db),
  }
}
