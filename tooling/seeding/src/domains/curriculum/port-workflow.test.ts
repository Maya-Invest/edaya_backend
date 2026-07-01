import type {
  CurriculumSeedPort,
  GradeLevelSubjectMatterSeedRecord,
  GradeLevelSubjectSeedRecord,
  SubjectMatterSeedRecord,
  SubjectSeedRecord,
} from './port'
import { SubjectCategory, SubjectColor } from '@edaya/core'
import {
  SEED_GRADE_LEVEL_SUBJECT_MATTERS,
  SEED_GRADE_LEVEL_SUBJECTS,
  SEED_SUBJECT_CATALOG,
  SEED_SUBJECT_MATTERS,
} from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevCurriculum } from './workflow'

describe('curriculum seed port workflow', () => {
  test('seeds validated subject and grade-level curriculum records', async () => {
    const subjects: SubjectSeedRecord[] = []
    const matters: SubjectMatterSeedRecord[] = []
    const offerings: GradeLevelSubjectSeedRecord[] = []
    const assignments: GradeLevelSubjectMatterSeedRecord[] = []
    const port: CurriculumSeedPort = {
      saveSubject: async (record) => {
        subjects.push(record)
      },
      saveSubjectMatter: async (record) => {
        matters.push(record)
      },
      offerSubjectToGradeLevel: async (record) => {
        offerings.push(record)
      },
      assignMatterToGradeLevelSubject: async (record) => {
        assignments.push(record)
      },
    }

    await seedDevCurriculum(port)

    expect(subjects).toHaveLength(SEED_SUBJECT_CATALOG.length)
    const firstSubject = subjects[0]
    if (!firstSubject) {
      throw new Error('Expected seeded subjects')
    }
    expect(Object.values(SubjectCategory)).toContain(firstSubject.category)
    expect(Object.values(SubjectColor)).toContain(firstSubject.color)
    expect(matters).toHaveLength(SEED_SUBJECT_MATTERS.length)
    expect(offerings).toHaveLength(SEED_GRADE_LEVEL_SUBJECTS.length)
    expect(assignments).toHaveLength(SEED_GRADE_LEVEL_SUBJECT_MATTERS.length)
  })
})
