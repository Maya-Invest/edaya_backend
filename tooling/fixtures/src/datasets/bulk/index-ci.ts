import type { FixtureDataset } from '../types'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import { demoDataset } from '../demo'
import { localizeDemoDatasetForCi } from '../demo/localize-demo-for-ci'
import { mergeDemoWithGeneratedPopulation } from './merge-with-demo'
import { bulkCiPopulationSlice } from './population-ci'

const localizedDemo = localizeDemoDatasetForCi(demoDataset)

const generatedPopulationLayer = {
  purpose: 'bulk',
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  entities: bulkCiPopulationSlice,
} satisfies FixtureDataset<'bulk'>

/** Full dev school with Ivorian names: demo fixtures + 970 generated students (1000 total). */
export const bulkCiDataset = mergeDemoWithGeneratedPopulation(localizedDemo, generatedPopulationLayer)
