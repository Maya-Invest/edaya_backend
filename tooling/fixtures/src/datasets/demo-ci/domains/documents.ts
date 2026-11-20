import type { FixtureDocumentIssuance } from '../../types'
import { DEMO_CI_ACADEMIC_YEAR_ID } from '../../../shared/ids'

export const demoCiDocumentIssuances = [
  {
    id: 'ci-doc-receipt-s1',
    requestId: 'ci-seed-receipt-s1',
    templateKey: 'receipt.v1',
    sourceId: 'ci-pay-120',
    studentId: 'ci-s1',
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    status: 'ready',
  },
  {
    id: 'ci-doc-certificate-s1',
    requestId: 'ci-seed-certificate-s1',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'ci-enr-s1',
    studentId: 'ci-s1',
    classGroupId: 'ci-6a',
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    status: 'ready',
  },
  {
    id: 'ci-doc-certificate-s2-failed',
    requestId: 'ci-seed-certificate-s2-failed',
    templateKey: 'schooling-certificate.v1',
    sourceId: 'ci-enr-s2',
    studentId: 'ci-s2',
    classGroupId: 'ci-6a',
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    status: 'failed',
    failureCode: 'DOCUMENT_RENDER_UNAVAILABLE',
  },
] as const satisfies readonly FixtureDocumentIssuance[]
