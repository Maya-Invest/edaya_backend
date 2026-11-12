import { GradeScale, withShortName } from '@edaya/core'
import { onboardingDatasetSchema } from '@edaya/service'
import { describe, expect, test } from 'bun:test'
import { IVORY_COAST_ONBOARDING_DATASET, IVORY_COAST_STRUCTURE_TEMPLATES, loadIvoryCoastFixture, loadIvoryCoastFixtureFromRecords, resolveOnboardingDataset } from '../../../src/onboarding/index'

const dataset = IVORY_COAST_ONBOARDING_DATASET
function sorted(value: unknown): unknown {
  if (Array.isArray(value))
    return value.map(sorted)
  if (value && typeof value === 'object')
    return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, sorted(entry)]))
  return value
}
describe('canonical onboarding dataset', () => {
  test('matches the bundled and filesystem versions and resolves exact versions', async () => {
    expect(await loadIvoryCoastFixture()).toEqual(dataset)
    expect(resolveOnboardingDataset('ci-general-secondary', '1.0.0')).toEqual(dataset)
    expect(() => resolveOnboardingDataset('ci-general-secondary', '2.0.0')).toThrow('Unknown onboarding dataset')
    expect(() => resolveOnboardingDataset('missing', '1.0.0')).toThrow()
    expect(dataset.disciplines).toHaveLength(15)
    expect(dataset.subjectCategories).toHaveLength(6)
    expect(dataset.templates.flatMap(row => row.gradeLevels)).toHaveLength(12)
  })
  test('pins canonical template content with curated short names', () => {
    const legacy = IVORY_COAST_STRUCTURE_TEMPLATES.map(({ subjectCategories: _categories, ...template }) => ({ ...template, subjects: template.subjects.map(({ categoryCode: _code, ...subject }) => subject) }))
    const hash = new Bun.CryptoHasher('sha256').update(JSON.stringify(sorted(legacy))).digest('hex')
    expect(hash).toBe('0963a0795352379ae6de15b058aa594ba807f2b25da39e5e9968694e485a7831')
  })
  test('stores the requested nine bands and classifies every boundary', () => {
    const preset = dataset.gradeScales[0]!
    expect(preset.ranges.map(row => row.label)).toEqual(['Très-faible', 'Faible', 'Très-insuffisant', 'Insuffisant', 'Passable', 'Assez-Bien', 'Bien', 'Très-Bien', 'Excellent'])
    const scale = new GradeScale(withShortName({ ...preset, id: preset.code, schoolId: 'test', ranges: preset.ranges.map(row => ({ id: row.code, letter: row.code, minScore: row.minScore, maxScore: row.maxScore, interpretation: row.label })) }))
    for (const [index, range] of preset.ranges.entries()) {
      expect(scale.findRange(range.minScore)?.letter).toBe(range.code)
      expect(scale.findRange(range.maxScore - 0.01)?.letter).toBe(range.code)
      if (index > 0)
        expect(scale.findRange(range.minScore - 0.01)?.letter).toBe(preset.ranges[index - 1]!.code)
    }
    expect(scale.findRange(20)?.letter).toBe('EX')
    expect(scale.findRange(-0.01)).toBeUndefined()
    expect(scale.findRange(20.01)).toBeUndefined()
  })
  test('rejects broken references, duplicates, invalid ordering and grading bands', () => {
    const mutations: Array<(value: typeof dataset) => void> = [
      (value) => { value.schemaVersion = 2 as 1 },
      (value) => { value.disciplines.push(value.disciplines[0]!) },
      (value) => { value.templates[0]!.gradeLevels[0]!.subjects[0]!.disciplineCode = 'missing' },
      (value) => { value.templates[0]!.gradeLevels[0]!.subjects[0]!.categoryCode = 'missing' },
      (value) => { value.templates[0]!.gradeLevels[0]!.subjects[0]!.reportModuleCode = 'missing' },
      (value) => { value.templates[0]!.gradeLevels[0]!.subjects[0]!.coefficient = 0 },
      (value) => { value.templates[0]!.calendarProfileCode = 'missing' },
      (value) => { value.templates[0]!.gradeLevels[0]!.gradingPolicy.gradeScaleCode = 'missing' },
      (value) => { value.templates[0]!.gradeLevels[0]!.reportModules[0]!.explicitWeight = 2 },
      (value) => { value.gradeScales[0]!.ranges[1]!.minScore = 3 },
      (value) => { value.gradeScales[0]!.ranges[1]!.minScore = 5 },
      (value) => { value.templates[0]!.gradeLevels[0]!.subjects[0]!.chapters[1]!.order = 1 },
    ]
    for (const mutate of mutations) {
      const value = structuredClone(dataset)
      mutate(value)
      expect(onboardingDatasetSchema.safeParse(value).success).toBe(false)
    }
  })
  test('rejects unsafe and missing level paths', async () => {
    const master = await Bun.file(new URL('../../../data/onboarding/ivory-coast/fixture.json', import.meta.url)).json()
    master.templates[0].gradeLevels[0].file = '../escape.json'
    expect(() => loadIvoryCoastFixtureFromRecords(master, {})).toThrow('Unsafe')
    master.templates[0].gradeLevels[0].file = 'missing.json'
    expect(() => loadIvoryCoastFixtureFromRecords(master, {})).toThrow('Missing')
  })
})
