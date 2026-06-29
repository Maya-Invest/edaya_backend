import type {
  ClassSubjectMatterSeedRecord,
  ClassSubjectSeedRecord,
  CurriculumSeedPort,
  SubjectMatterSeedRecord,
  SubjectSeedRecord,
} from './port'
import { ClassSubjectMatterStatus, SubjectCategory, SubjectColor } from '@edaya/core'
import {
  SEED_CLASS_SUBJECT_MATTERS,
  SEED_CLASS_SUBJECTS,
  SEED_SUBJECT_CATALOG,
  SEED_SUBJECT_MATTERS,
} from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevCurriculum } from './workflow'

describe('curriculum seed port workflow', () => {
  test('seeds validated subject and class curriculum records', async () => {
    const subjects: SubjectSeedRecord[] = []
    const matters: SubjectMatterSeedRecord[] = []
    const offerings: ClassSubjectSeedRecord[] = []
    const assignments: ClassSubjectMatterSeedRecord[] = []
    const port: CurriculumSeedPort = {
      saveSubject: async (record) => {
        subjects.push(record)
      },
      saveSubjectMatter: async (record) => {
        matters.push(record)
      },
      offerSubjectToClass: async (record) => {
        offerings.push(record)
      },
      assignMatterToClassSubject: async (record) => {
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
    expect(offerings).toHaveLength(SEED_CLASS_SUBJECTS.length)
    expect(assignments).toHaveLength(SEED_CLASS_SUBJECT_MATTERS.length)
    expect(assignments.every(record =>
      record.status === ClassSubjectMatterStatus.NotStarted
      && record.completedPercentage === 0,
    )).toBe(true)
  })
})
