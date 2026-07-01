import type { FixtureDataset } from '../types'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import {
  integrationEnrollments,
  integrationGuardianLinks,
  integrationGuardians,
  integrationStudents,
} from './people'

export const integrationDataset = {
  purpose: 'integration',
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  entities: {
    students: integrationStudents,
    guardians: integrationGuardians,
    enrollments: integrationEnrollments,
    guardianLinks: integrationGuardianLinks,
  },
} satisfies FixtureDataset<'integration'>
