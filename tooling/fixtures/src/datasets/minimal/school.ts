import type { SchoolInput } from '@edaya/core'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'

export const minimalSchool = {
  id: DEMO_CENTRAL_SCHOOL_ID,
  name: 'EDAYA — Campus Central',
  timeZone: 'America/Toronto',
  city: 'Ottawa',
  country: 'CA',
} satisfies SchoolInput
