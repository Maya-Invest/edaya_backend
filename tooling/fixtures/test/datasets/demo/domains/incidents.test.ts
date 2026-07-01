import { describe, expect, it } from 'bun:test'
import { demoIncidents } from '../../../../src/datasets/demo/domains/incidents'
import { incidentPresentationFor } from '../../../../src/meta/narrative'

describe('demo incidents', () => {
  it('domain incidents exclude presentation metadata', () => {
    const incident = demoIncidents[0]
    expect(incident).not.toHaveProperty('mockCategory')
    expect(incident).not.toHaveProperty('mockSeverity')
  })

  it('presentation metadata maps by incident id', () => {
    expect(demoIncidents).toHaveLength(3)
    expect(incidentPresentationFor('i1')).toEqual({
      mockCategory: 'Tardiness',
      mockSeverity: 'low',
    })
  })
})
