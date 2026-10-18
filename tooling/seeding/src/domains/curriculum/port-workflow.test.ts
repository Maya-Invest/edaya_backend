import type {
  CurriculumSeedPort,
  SubjectMatterSeedRecord,
  SubjectSeedRecord,
} from './port'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { buildFixtureCurriculumPlan } from '../../support/curriculum-plan'
import { seedDevCurriculum } from './workflow'

describe('curriculum seed port workflow', () => {
  test('seeds validated subject and grade-level curriculum records', async () => {
    const seededSubjects: SubjectSeedRecord[] = []
    const seededMatters: SubjectMatterSeedRecord[] = []
    const port: CurriculumSeedPort = {
      saveSubject: async (record) => {
        seededSubjects.push(record)
      },
      saveSubjectMatter: async (record) => {
        seededMatters.push(record)
      },
    }

    await seedDevCurriculum(port, demoCiDataset)

    const curriculumPlan = buildFixtureCurriculumPlan(demoCiDataset.entities)
    const fixtureSubjects = demoCiDataset.entities.subjects ?? []
    const fixtureSubjectMatters = demoCiDataset.entities.subjectMatters ?? []

    expect(seededSubjects).toHaveLength(fixtureSubjects.length)
    const firstSubject = seededSubjects[0]
    if (!firstSubject) {
      throw new Error('Expected seeded subjects')
    }
    expect(seededMatters).toHaveLength(fixtureSubjectMatters.length)
    expect(seededSubjects).toEqual(curriculumPlan.subjects)
    expect(firstSubject.gradeLevelId).toBe(fixtureSubjects[0]!.gradeLevelId)
  })
})
