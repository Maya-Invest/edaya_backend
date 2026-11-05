import { describe, expect, it } from 'bun:test'
import { buildStructureBootstrapGraph, resolveDatasetStructure } from '../../../src/capabilities/onboarding/apply-structure-template'
import { createOnboardingTestDataset } from '../../support/onboarding-dataset'

describe('canonical structure graph', () => {
  it('preserves optional offerings, repeated chapter titles, explicit orders and custom identities', async () => {
    const dataset = createOnboardingTestDataset()
    const template = dataset.templates[0]!
    template.id = 'custom-primary'
    const level = template.gradeLevels[0]!
    level.id = `${template.id}:${level.code}`
    const subject = level.subjects[0]!
    subject.isOptional = true
    subject.chapters = [{ code: 'B', title: 'Repeated title', order: 9 }, { code: 'A', title: 'Repeated title', order: 2 }]
    const levels = resolveDatasetStructure({ dataset, templates: [template.id], levels: [{ gradeLevelId: level.id, classCount: 2, capacity: 30, classNamingMode: 'alphabetical' }] })
    const application = { commandExecution: { execute: async (input: { execute: () => Promise<string> }) => input.execute() }, repositories: { gradeLevels: { findById: async () => undefined }, classGroups: { findById: async () => undefined } } }
    const graph = await buildStructureBootstrapGraph(application as never, 'school', 'year', levels, new Map([['MATH', 'math-id']]), new Map([['SCI', 'science-id']]), dataset.id)
    expect(graph.subjects[0]!.disciplineId).toBe('math-id')
    expect(graph.subjects[0]!.categoryId).toBe('science-id')
    expect(graph.subjects[0]!.coefficient).toBe(4)
    expect(graph.subjects[0]!.reportOrder).toBe(3)
    expect(graph.classGroups.map(row => row.name)).toEqual(['4ème A', '4ème B'])
    expect(graph.classSubjects.every(row => !row.isOffered)).toBe(true)
    expect(graph.subjectMatters.map(row => row.sequenceOrder)).toEqual([2, 9])
    expect(new Set(graph.subjectMatters.map(row => row.id)).size).toBe(2)
    expect(graph.classSubjectMatters).toHaveLength(4)
  })
  it('rejects unknown or repeated selections before allocating curriculum', () => {
    const dataset = createOnboardingTestDataset()
    const selection = { gradeLevelId: 'ci-college:4EME', classCount: 1, capacity: 30 }
    expect(() => resolveDatasetStructure({ dataset, templates: ['unknown'], levels: [selection] })).toThrow('Unknown dataset template')
    expect(() => resolveDatasetStructure({ dataset, templates: ['ci-college'], levels: [selection, selection] })).toThrow('distinct grade levels')
  })
})
