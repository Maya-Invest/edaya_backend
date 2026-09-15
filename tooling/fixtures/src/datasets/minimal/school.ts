import type { SchoolInput } from '@edaya/core'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'

export const minimalSchool = {
  id: DEMO_CENTRAL_SCHOOL_ID,
  name: 'EDAYA — Campus Central',
  timeZone: 'America/Toronto',
  city: 'Ottawa',
  country: 'CA',
  issuingName: 'EDAYA — Campus Central',
  postalAddress: '100 Rideau Street, Ottawa, ON K1N 5W8',
  phone: '+1 613 555 0100',
  email: 'secretariat@edaya.test',
  schoolCode: 'EDAYA-OTT',
} satisfies SchoolInput
