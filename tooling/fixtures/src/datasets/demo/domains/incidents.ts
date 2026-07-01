import type { IncidentInput, StudentIncidentInvolvementInput } from '@edaya/core'
import { IncidentInvolvementRole, IncidentKind } from '@edaya/core'
import { DEMO_CENTRAL_SCHOOL_ID } from '../../../shared/ids'

export const demoIncidents = [
  {
    id: 'i1',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    classGroupId: '6a',
    title: 'Repeated tardiness',
    description: 'Late to class 3 times this month.',
    date: '2026-04-12T12:00:00.000Z',
    kind: IncidentKind.MinorInfraction,
    reporterId: 'st7',
  },
  {
    id: 'i2',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    classGroupId: '6a',
    title: 'Class disruption',
    description: 'Disruption during English class.',
    date: '2026-03-22T12:00:00.000Z',
    kind: IncidentKind.MinorInfraction,
    reporterId: 'st7',
  },
  {
    id: 'i3',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    classGroupId: '6a',
    title: 'Recess conflict',
    description: 'Argument with classmate during recess.',
    date: '2026-04-26T12:00:00.000Z',
    kind: IncidentKind.MajorInfraction,
    reporterId: 'st7',
  },
] as const satisfies readonly IncidentInput[]

export const demoStudentIncidentInvolvements = [
  {
    id: 'inv-i1-s3',
    incidentId: 'i1',
    studentId: 's3',
    role: IncidentInvolvementRole.Subject,
    createdAt: '2026-04-12T12:00:00.000Z',
  },
  {
    id: 'inv-i2-s2',
    incidentId: 'i2',
    studentId: 's2',
    role: IncidentInvolvementRole.Subject,
    createdAt: '2026-03-22T12:00:00.000Z',
  },
  {
    id: 'inv-i3-s3',
    incidentId: 'i3',
    studentId: 's3',
    role: IncidentInvolvementRole.Subject,
    createdAt: '2026-04-26T12:00:00.000Z',
  },
] as const satisfies readonly StudentIncidentInvolvementInput[]
