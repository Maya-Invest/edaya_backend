import type { IncidentInput, StudentIncidentInvolvementInput } from '@edaya/core'
import { IncidentInvolvementRole, IncidentKind } from '@edaya/core'
import { DEMO_CI_SCHOOL_ID } from '../../../shared/ids'

export const demoCiIncidents = [
  {
    id: 'ci-i1',
    schoolId: DEMO_CI_SCHOOL_ID,
    classGroupId: 'ci-6a',
    title: 'Retards répétés',
    description: 'Retard en cours à 3 reprises ce mois-ci.',
    date: '2026-09-16T12:00:00.000Z',
    kind: IncidentKind.MinorInfraction,
    reporterId: 'ci-st7',
  },
  {
    id: 'ci-i2',
    schoolId: DEMO_CI_SCHOOL_ID,
    classGroupId: 'ci-6a',
    title: 'Perturbation en cours',
    description: 'Perturbation pendant le cours d\'anglais.',
    date: '2026-09-15T12:00:00.000Z',
    kind: IncidentKind.MinorInfraction,
    reporterId: 'ci-st7',
  },
  {
    id: 'ci-i3',
    schoolId: DEMO_CI_SCHOOL_ID,
    classGroupId: 'ci-6b',
    title: 'Conflit en récréation',
    description: 'Dispute avec un camarade pendant la récréation.',
    date: '2026-09-17T12:00:00.000Z',
    kind: IncidentKind.MajorInfraction,
    reporterId: 'ci-st7',
  },
] as const satisfies readonly IncidentInput[]

export const demoCiStudentIncidentInvolvements = [
  { id: 'ci-inv-i1-s3', incidentId: 'ci-i1', studentId: 'ci-s3', role: IncidentInvolvementRole.Subject, createdAt: '2026-09-16T12:00:00.000Z' },
  { id: 'ci-inv-i2-s2', incidentId: 'ci-i2', studentId: 'ci-s2', role: IncidentInvolvementRole.Subject, createdAt: '2026-09-15T12:00:00.000Z' },
  { id: 'ci-inv-i3-s14', incidentId: 'ci-i3', studentId: 'ci-s14', role: IncidentInvolvementRole.Subject, createdAt: '2026-09-17T12:00:00.000Z' },
] as const satisfies readonly StudentIncidentInvolvementInput[]
