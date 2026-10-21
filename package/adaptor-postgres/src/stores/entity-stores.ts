import type { StoreDatabase } from '../postgres-store'
import type { EntityStores } from './entity-stores-types'
import { AcademicDiscipline, PlacementStatus, StudentAcademicYearProfile, TeacherAcademicYearProfile } from '@edaya/core'
import { defaultStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'
import { createAcademicsEntityStores } from './entity-stores-academics'
import { createAssessmentsEntityStores } from './entity-stores-assessments'
import { createDocumentsEntityStores } from './entity-stores-documents'
import { createFinancesEntityStores } from './entity-stores-finances'
import { createMessagingEntityStores } from './entity-stores-messaging'
import { createSchedulingEntityStores } from './entity-stores-scheduling'
import { createSchoolEntityStores } from './entity-stores-school'
import { createStudentsEntityStores } from './entity-stores-students'

export type { EntityStores } from './entity-stores-types'

export function createEntityStores(db: StoreDatabase): EntityStores {
  return {
    academicDisciplines: defaultStore(db, schema.academicDisciplines, AcademicDiscipline),
    placementStatuses: defaultStore(db, schema.placementStatuses, PlacementStatus),
    studentAcademicYearProfiles: defaultStore(db, schema.studentAcademicYearProfiles, StudentAcademicYearProfile),
    teacherAcademicYearProfiles: defaultStore(db, schema.teacherAcademicYearProfiles, TeacherAcademicYearProfile),

    ...createSchoolEntityStores(db),
    ...createAcademicsEntityStores(db),
    ...createStudentsEntityStores(db),
    ...createSchedulingEntityStores(db),
    ...createAssessmentsEntityStores(db),
    ...createFinancesEntityStores(db),
    ...createDocumentsEntityStores(db),
    ...createMessagingEntityStores(db),
  }
}
