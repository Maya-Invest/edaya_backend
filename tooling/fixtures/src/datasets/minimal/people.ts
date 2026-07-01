import type { GuardianInput, StaffMemberInput } from '@edaya/core'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'

/** Primary staff fixture for Better Auth integration tests (`st8`). */
export const minimalStaffMember = {
  id: 'st8',
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  firstName: 'Koussi',
  lastName: 'Yann',
  email: 'k.yann@school.edu',
} satisfies StaffMemberInput

/** Primary guardian fixture for Better Auth integration tests (`g1`). */
export const minimalGuardian = {
  id: 'g1',
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  firstName: 'Claire',
  lastName: 'Laurent',
  email: 'c.laurent@mail.com',
  phone: '+33 6 12 34 56 78',
} satisfies GuardianInput
