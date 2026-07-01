import type { FixtureDataset } from '../types'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import { demoDataset } from '../demo'
import { mergeDemoWithGeneratedPopulation } from './merge-with-demo'
import {
  bulkClassGroups,
  bulkEnrollments,
  bulkGuardianLinks,
  bulkGuardians,
  bulkStudents,
} from './population'

const generatedPopulationLayer = {
  purpose: 'bulk',
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  entities: {
    classGroups: bulkClassGroups,
    students: bulkStudents,
    guardians: bulkGuardians,
    enrollments: bulkEnrollments,
    guardianLinks: bulkGuardianLinks,
  },
} satisfies FixtureDataset<'bulk'>

/** Full dev school: demo fixtures merged with procedurally generated population. */
export const bulkDataset = mergeDemoWithGeneratedPopulation(demoDataset, generatedPopulationLayer)
