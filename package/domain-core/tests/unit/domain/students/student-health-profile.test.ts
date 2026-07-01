import { describe, expect, test } from 'bun:test'
import { StudentHealthProfile } from '../../../../src/domain/students/student-health-profile'

describe('StudentHealthProfile entity', () => {
  const baseArgs = {
    id: 'shp1',
    schoolId: 'sch1',
    studentId: 'stu1',
  }

  test('instantiates successfully with valid inputs', () => {
    const profile = new StudentHealthProfile({
      ...baseArgs,
      allergies: 'Peanuts',
      medications: 'EpiPen',
      clinicalNotes: 'Severe peanut allergy. EpiPen in nurse\'s office.',
      lastVisit: new Date('2026-04-08T00:00:00Z'),
      bloodType: 'O+',
    })

    expect(profile.id).toBe('shp1')
    expect(profile.schoolId).toBe('sch1')
    expect(profile.studentId).toBe('stu1')
    expect(profile.allergies).toBe('Peanuts')
    expect(profile.medications).toBe('EpiPen')
    expect(profile.clinicalNotes).toBe('Severe peanut allergy. EpiPen in nurse\'s office.')
    expect(profile.lastVisit?.toISOString()).toBe('2026-04-08T00:00:00.000Z')
    expect(profile.bloodType).toBe('O+')
    expect(profile.createdAt).toBeInstanceOf(Date)
    expect(profile.updatedAt).toBeInstanceOf(Date)
  })

  test('throws error if updatedAt is before createdAt', () => {
    expect(() => {
      new StudentHealthProfile({
        ...baseArgs,
        createdAt: new Date('2026-09-02T00:00:00Z'),
        updatedAt: new Date('2026-09-01T00:00:00Z'),
      })
    }).toThrow('updatedAt must not be before createdAt')
  })
})
