import type { FixtureDocumentIssuance } from '../../types'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID } from '../../../shared/ids'

export const demoDocumentIssuances = [
  {
    id: 'doc-bulletin-s1',
    requestId: 'seed-bulletin-s1',
    templateKey: 'report-card.v1',
    sourceId: 'rcr-s1-t1',
    studentId: 's1',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    status: 'ready',
  },
  {
    id: 'doc-receipt-s1',
    requestId: 'seed-receipt-s1',
    templateKey: 'receipt.v1',
    sourceId: 'pay-120',
    studentId: 's1',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    status: 'ready',
  },
  {
    id: 'doc-certificate-s1',
    requestId: 'seed-certificate-s1',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'enr-s1',
    studentId: 's1',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    status: 'ready',
  },
  {
    id: 'doc-certificate-s2-failed',
    requestId: 'seed-certificate-s2-failed',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'enr-s2',
    studentId: 's2',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    status: 'failed',
    failureCode: 'DOCUMENT_RENDER_UNAVAILABLE',
  },
] as const satisfies readonly FixtureDocumentIssuance[]
