import type { StructureTemplateDefinition } from '../../../src/capabilities/onboarding/structure-template-types'
import { describe, expect, it } from 'bun:test'
import {
  buildStructureBootstrapGraph,
  curriculumEntriesForLevel,
} from '../../../src/capabilities/onboarding/apply-structure-template'

const college: StructureTemplateDefinition = {
  id: 'ci-college',
  countryCode: 'CI',
  label: 'Collège',
  description: 'Test',
  cycle: 'college',
  gradeLevels: [{
    id: 'ci-college:4EME',
    code: '4EME',
    name: '4ème',
    shortLabel: '4ème',
    order: 3,
  }],
  subjects: [
    { code: 'MATH', shortName: 'Math', domain: 'scientific', defaultCoefficient: 4 },
    { code: 'FR', shortName: 'Fr', domain: 'literary', defaultCoefficient: 3 },
  ],
  curriculum: [
    { levelCode: '4EME', subjectCode: 'MATH', coefficient: 4, matters: ['Nombres', 'Géométrie'] },
    { levelCode: '4EME', subjectCode: 'FR', coefficient: 3, matters: ['Grammaire'] },
  ],
}

describe('buildStructureBootstrapGraph', () => {
  it('builds linked curriculum and class mirrors for a fixture level', async () => {
    const levelDef = college.gradeLevels.find(level => level.code === '4EME')
    expect(levelDef).toBeTruthy()

    const application = {
      repositories: {
        gradeLevels: { findById: async () => undefined },
        classGroups: { findById: async () => undefined },
      },
    }

    const graph = await buildStructureBootstrapGraph(
      application as never,
      'school-1',
      'year-1',
      [{
        gradeLevelId: levelDef!.id,
        classCount: 2,
        capacity: 30,
        template: college,
        levelCode: '4EME',
      }],
      new Map([['MATH', 'discipline-math'], ['FR', 'discipline-fr']]),
    )

    const entries = curriculumEntriesForLevel(college, '4EME')
    expect(graph.gradeLevels).toHaveLength(1)
    expect(graph.classGroups).toHaveLength(2)
    expect(graph.subjects).toHaveLength(entries.length)
    expect(graph.subjects.every(subject => subject.disciplineId)).toBe(true)
    expect(graph.classSubjects).toHaveLength(entries.length * 2)
    expect(graph.classSubjects.every(entry => entry.subjectId)).toBe(true)
    expect(graph.classSubjectMatters.length).toBeGreaterThan(0)
    expect(graph.subjectCount).toBe(graph.subjects.length)
    expect(graph.classSubjectCount).toBe(entries.length * 2)

    for (const classSubject of graph.classSubjects) {
      const gls = graph.subjects.find(entry => entry.id === classSubject.subjectId)
      expect(gls).toBeTruthy()
      expect(classSubject.subjectId).toBe(gls!.id)
      expect(classSubject.isOffered).toBe(!gls!.isOptional)
    }
  })
})
