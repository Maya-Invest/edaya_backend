import type { FixtureDataset } from '../types'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import { minimalGuardian, minimalStaffMember } from './people'
import { minimalSchool } from './school'

export const minimalDataset = {
  purpose: 'minimal',
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  entities: {
    school: minimalSchool,
    staffMembers: [minimalStaffMember],
    guardians: [minimalGuardian],
  },
} satisfies FixtureDataset<'minimal'>
