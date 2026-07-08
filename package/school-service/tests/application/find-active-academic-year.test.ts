import type { SchoolRepositories } from '@edaya/school-service'
import { AcademicYear } from '@edaya/core'
import { findActiveAcademicYear } from '@edaya/school-service'
import { describe, expect, test } from 'bun:test'

function academicYearsRepo(
  list: SchoolRepositories['academicYears']['list'],
): SchoolRepositories['academicYears'] {
  return { list } as unknown as SchoolRepositories['academicYears']
}

describe('findActiveAcademicYear', () => {
  test('returns the active academic year when one is marked active', async () => {
    const active = new AcademicYear({
      id: 'year-active',
      schoolId: 'school-1',
      name: '2025-2026',
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-15'),
      isActive: true,
    })
    const inactive = new AcademicYear({
      id: 'year-old',
      schoolId: 'school-1',
      name: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-07-15'),
      isActive: false,
    })

    const result = await findActiveAcademicYear(
      academicYearsRepo(async () => [inactive, active]),
      'school-1',
    )

    expect(result?.id).toBe('year-active')
  })

  test('falls back to the first listed year when none are active', async () => {
    const first = new AcademicYear({
      id: 'year-first',
      schoolId: 'school-1',
      name: '2024-2025',
      startDate: new Date('2024-09-01'),
      endDate: new Date('2025-07-15'),
      isActive: false,
    })

    const result = await findActiveAcademicYear(
      academicYearsRepo(async () => [first]),
      'school-1',
    )

    expect(result?.id).toBe('year-first')
  })

  test('returns undefined when the school has no academic years', async () => {
    const result = await findActiveAcademicYear(
      academicYearsRepo(async () => []),
      'school-1',
    )

    expect(result).toBeUndefined()
  })
})
