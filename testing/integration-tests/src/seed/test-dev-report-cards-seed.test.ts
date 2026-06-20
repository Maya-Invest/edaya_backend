import {
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_GRADE_SCALES,
  SEED_REPORT_CARD_DEFINITIONS,
  SEED_REPORT_CARD_RESULTS,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool } from '../support/seeded-route-test-context'

function unwrapEntity<T>(value: unknown): T {
  if (Array.isArray(value)) {
    return value.map(entry => unwrapEntity(entry)) as T
  }
  if (value && typeof value === 'object' && 'data' in value && value.data && typeof value.data === 'object') {
    const record = value as Record<string, unknown>
    const merged: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(record.data as Record<string, unknown>)) {
      merged[key] = unwrapEntity(entry)
    }
    for (const [key, entry] of Object.entries(record)) {
      if (key === 'data') {
        continue
      }
      merged[key] = unwrapEntity(entry)
    }
    return merged as T
  }
  return value as T
}

function unwrapEntityList<T>(values: unknown): T[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values.map(entry => unwrapEntity<T>(entry))
}

const expectedSectionCount = SEED_REPORT_CARD_DEFINITIONS.reduce((total, definition) => {
  return total + definition.sections.reduce((sectionTotal, section) => {
    return sectionTotal + 1 + section.subjectIds.length
  }, 0)
}, 0)

describeWithSeededSchool('dev report cards seed', (getContext) => {
  it('seeds grade scales, report card definitions and results and lets staff list report-card entities', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.gradeScales).toBe(SEED_GRADE_SCALES.length)
    expect(seedResult.reportCardDefinitions).toBe(SEED_REPORT_CARD_DEFINITIONS.length)
    expect(seedResult.reportCardSections).toBe(expectedSectionCount)
    expect(seedResult.reportCardResults).toBe(SEED_REPORT_CARD_RESULTS.length)

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [gradeScalesResponse, definitionsResponse, sectionsResponse, resultsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/grade-scales/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/definitions/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/sections/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/results/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(gradeScalesResponse.status).toBe(200)
    expect(definitionsResponse.status).toBe(200)
    expect(sectionsResponse.status).toBe(200)
    expect(resultsResponse.status).toBe(200)

    const gradeScales = unwrapEntityList<{
      id: string
      name: string
      decimalPlaces?: number
      description?: string
      ranges?: { minScore: number, isPassing: boolean }[]
    }>(await gradeScalesResponse.json())
    const definitions = unwrapEntityList<{
      id: string
      name: string
      gradeScaleId?: string
      status?: string
    }>(await definitionsResponse.json())
    const sections = unwrapEntityList<{
      id: string
      reportCardDefinitionId: string
      role?: string
      coefficient?: number
    }>(await sectionsResponse.json())
    const results = unwrapEntityList<{
      id: string
      studentId: string
      sectionResults?: Array<{
        sectionId: string
        subResults?: Array<{
          classSubjectId?: string
          comment?: string
          average?: number
        }>
      }>
    }>(await resultsResponse.json())

    expect(gradeScales.length).toBeGreaterThanOrEqual(SEED_GRADE_SCALES.length)
    expect(definitions.length).toBeGreaterThanOrEqual(SEED_REPORT_CARD_DEFINITIONS.length)
    expect(sections.length).toBeGreaterThanOrEqual(expectedSectionCount)
    expect(results.length).toBeGreaterThanOrEqual(SEED_REPORT_CARD_RESULTS.length)
    expect(gradeScales.some(scale => scale.id === 'gs-20')).toBe(true)
    expect(gradeScales.find(scale => scale.id === 'gs-20')?.decimalPlaces).toBe(2)
    expect(gradeScales.find(scale => scale.id === 'gs-20')?.description).toContain('seuil de réussite à 10')
    expect(gradeScales.find(scale => scale.id === 'gs-lettres')?.decimalPlaces).toBe(0)
    const gs20Passing = gradeScales
      .find(scale => scale.id === 'gs-20')
      ?.ranges
      ?.filter(range => range.isPassing)
      .map(range => range.minScore) ?? []
    expect(Math.min(...gs20Passing)).toBe(10)
    expect(definitions.some(definition => definition.id === 'rcd-ms-6')).toBe(true)
    expect(definitions.some(definition => definition.id === 'rcd-term')).toBe(true)
    expect(definitions.some(definition => definition.id === 'rcd-ms-draft')).toBe(true)
    expect(definitions.find(definition => definition.id === 'rcd-ms-6')?.gradeScaleId).toBe('gs-20')
    expect(definitions.find(definition => definition.id === 'rcd-ms-6')?.status).toBe('published')
    expect(definitions.find(definition => definition.id === 'rcd-ms-draft')?.status).toBe('draft')
    expect(sections.find(section => section.id === 'rcs-ms-fond')?.role).toBe('matieres')
    expect(sections.find(section => section.id === 'rcs-ms-sci')?.coefficient).toBe(1.5)
    expect(sections.find(section => section.id === 'rcs-ms-synth')?.role).toBe('synthese')
    expect(sections.find(section => section.id === 'rcs-ms-appr')?.role).toBe('appreciation')
    expect(results.some(result => result.id === 'rcr-s1-t3' && result.studentId === 's1')).toBe(true)
    expect(results.some(result => result.id === 'rcr-s9-t3' && result.studentId === 's9')).toBe(true)

    const s1MathMark = results
      .find(result => result.id === 'rcr-s1-t3')
      ?.sectionResults
      ?.find(section => section.sectionId === 'rcs-ms-fond')
      ?.subResults
      ?.find(mark => mark.classSubjectId === 'cs-6a-math')
    expect(s1MathMark?.average).toBeGreaterThan(0)

    const s2MathMark = results
      .find(result => result.id === 'rcr-s2-t3')
      ?.sectionResults
      ?.find(section => section.sectionId === 'rcs-ms-fond')
      ?.subResults
      ?.find(mark => mark.classSubjectId === 'cs-6a-math')
    expect(s2MathMark?.average).toBeGreaterThan(0)
  })
})
