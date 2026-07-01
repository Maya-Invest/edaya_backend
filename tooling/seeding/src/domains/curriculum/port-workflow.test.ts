import type {
  CurriculumSeedPort,
  GradeLevelSubjectMatterSeedRecord,
  GradeLevelSubjectSeedRecord,
  SubjectMatterSeedRecord,
  SubjectSeedRecord,
} from './port'
import { SubjectCategory, SubjectColor } from '@edaya/core'
import { demoDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { buildFixtureCurriculumPlan } from '../../support/curriculum-plan'
import { seedDevCurriculum } from './workflow'

describe('curriculum seed port workflow', () => {
  test('seeds validated subject and grade-level curriculum records', async () => {
    const seededSubjects: SubjectSeedRecord[] = []
    const seededMatters: SubjectMatterSeedRecord[] = []
    const offerings: GradeLevelSubjectSeedRecord[] = []
    const assignments: GradeLevelSubjectMatterSeedRecord[] = []
    const port: CurriculumSeedPort = {
      saveSubject: async (record) => {
        seededSubjects.push(record)
      },
      saveSubjectMatter: async (record) => {
        seededMatters.push(record)
      },
      offerSubjectToGradeLevel: async (record) => {
        offerings.push(record)
      },
      assignMatterToGradeLevelSubject: async (record) => {
        assignments.push(record)
      },
    }

    await seedDevCurriculum(port, demoDataset)

    const curriculumPlan = buildFixtureCurriculumPlan(demoDataset.entities)
    const fixtureSubjects = demoDataset.entities.subjects ?? []
    const fixtureSubjectMatters = demoDataset.entities.subjectMatters ?? []

    expect(seededSubjects).toHaveLength(fixtureSubjects.length)
    const firstSubject = seededSubjects[0]
    if (!firstSubject) {
      throw new Error('Expected seeded subjects')
    }
    expect(Object.values(SubjectCategory)).toContain(firstSubject.category)
    expect(Object.values(SubjectColor)).toContain(firstSubject.color)
    expect(seededMatters).toHaveLength(fixtureSubjectMatters.length)
    expect(offerings).toHaveLength(curriculumPlan.gradeLevelSubjects.length)
    expect(assignments).toHaveLength(curriculumPlan.gradeLevelSubjectMatters.length)
  })
})
