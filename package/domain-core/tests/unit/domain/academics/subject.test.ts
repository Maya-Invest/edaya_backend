import type { SubjectInput } from '@edaya/core'
import { Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

describe('Subject entity', () => {
  test('requires an explicit category ID even when a legacy category name is supplied', () => {
    expect(() => new Subject({
      id: 'subject',
      schoolId: 'school',
      gradeLevelId: 'grade',
      academicYearId: 'year',
      name: 'Math',
      category: 'Scientifique',
    } as unknown as SubjectInput)).toThrow()
  })

  test('copyWith should copy with new values', () => {
    const subject = new Subject({
      categoryId: 'test-category',
      id: 'sub1',
      schoolId: 'school1',
      gradeLevelId: 'grade1',
      academicYearId: 'year1',
      name: 'Math — Grade 6',
      shortName: 'Math',
      code: 'MATH101',
      coefficient: 2,
    })

    const updated = subject.copyWith({
      name: 'Advanced Math — Grade 10',
      shortName: 'Advanced Math',
      code: 'MATH201',
      coefficient: 3,
    })

    expect(updated.id).toBe('sub1')
    expect(updated.schoolId).toBe('school1')
    expect(updated.name).toBe('Advanced Math — Grade 10')
    expect(updated.shortName).toBe('Advanced Math')
    expect(updated.displayShortName).toBe('Advanced Math')
    expect(updated.code).toBe('MATH201')
    expect(updated.coefficient).toBe(3)
    expect(updated.createdAt).toEqual(subject.createdAt)
  })

  test('copyWith should retain old values if not provided', () => {
    const subject = new Subject({
      categoryId: 'test-category',
      id: 'sub1',
      schoolId: 'school1',
      gradeLevelId: 'grade1',
      academicYearId: 'year1',
      name: 'Math',
      code: 'MATH101',
      coefficient: 2,
    })

    const updated = subject.copyWith({})

    expect(updated.name).toBe('Math')
    expect(updated.code).toBe('MATH101')
    expect(updated.coefficient).toBe(2)
  })

  test('copyWith retains optional values when overrides are undefined', () => {
    const subject = new Subject({
      categoryId: 'test-category',
      id: 'sub1',
      schoolId: 'school1',
      gradeLevelId: 'grade1',
      academicYearId: 'year1',
      name: 'Math',
      code: 'MATH101',
      coefficient: 2,
    })

    const updated = subject.copyWith({
      code: undefined,
      coefficient: undefined,
    })

    expect(updated.code).toBe('MATH101')
    expect(updated.coefficient).toBe(2)
  })
})
