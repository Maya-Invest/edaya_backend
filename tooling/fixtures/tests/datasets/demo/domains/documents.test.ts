import { describe, expect, it } from 'bun:test'
import { demoCiDocumentIssuances } from '../../../../src/datasets/demo-ci/domains/documents'
import { demoDocumentIssuances } from '../../../../src/datasets/demo/domains/documents'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, DEMO_CI_ACADEMIC_YEAR_ID } from '../../../../src/shared/ids'

describe('demo official documents', () => {
  it('seeds a ready bulletin, receipt, certificate, and a failed issuance', () => {
    expect(demoDocumentIssuances.map(row => row.status).sort()).toEqual(['failed', 'ready', 'ready', 'ready'])
    expect(demoDocumentIssuances.some(row => row.templateKey === 'report-card.v1' && row.sourceId === 'rcr-s1-t1')).toBe(true)
    expect(demoDocumentIssuances.some(row => row.templateKey === 'receipt.v1' && row.sourceId === 'pay-120')).toBe(true)
    expect(demoDocumentIssuances.some(row => row.templateKey === 'schooling-certificate.v1' && row.sourceId === 'enr-s1' && row.status === 'ready')).toBe(true)
    expect(demoDocumentIssuances.some(row => row.status === 'failed' && row.failureCode === 'DOCUMENT_RENDER_UNAVAILABLE')).toBe(true)
    expect(demoDocumentIssuances.every(row => row.academicYearId === DEMO_CENTRAL_ACADEMIC_YEAR_ID)).toBe(true)
  })

  it('mirrors the same UI states on demo-ci ids', () => {
    expect(demoCiDocumentIssuances).toHaveLength(demoDocumentIssuances.length)
    expect(demoCiDocumentIssuances.some(row => row.sourceId === 'ci-rcr-s1-t1')).toBe(true)
    expect(demoCiDocumentIssuances.some(row => row.sourceId === 'ci-pay-120')).toBe(true)
    expect(demoCiDocumentIssuances.every(row => row.academicYearId === DEMO_CI_ACADEMIC_YEAR_ID)).toBe(true)
  })
})
