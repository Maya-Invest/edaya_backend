import { describe, expect, it } from 'bun:test'
import { Student, StudentStatus } from '../../../../src/domain/students/student'
import { DomainValidationError } from '../../../../src/domain/shared/utils'

describe('Student biographical fields validation', () => {
  it('instantiates successfully with valid inputs', () => {
    const student = new Student({
      id: 'student-id-1',
      schoolId: 'school-id-1',
      firstName: 'Alice',
      lastName: 'Smith',
      gender: 'Female',
      birthDate: new Date('2015-05-10'),
      placeOfBirth: 'Paris',
      nationality: 'French',
      matricule: 'MAT-123',
      photoUrl: 'https://example.com/photo.jpg',
      status: StudentStatus.Active,
      enrollmentDate: new Date('2026-09-01'),
    })

    expect(student.id).toBe('student-id-1')
    expect(student.schoolId).toBe('school-id-1')
    expect(student.firstName).toBe('Alice')
    expect(student.lastName).toBe('Smith')
    expect(student.gender).toBe('Female')
    expect(student.birthDate).toEqual(new Date('2015-05-10'))
    expect(student.placeOfBirth).toBe('Paris')
    expect(student.nationality).toBe('French')
    expect(student.matricule).toBe('MAT-123')
    expect(student.photoUrl).toBe('https://example.com/photo.jpg')
    expect(student.status).toBe(StudentStatus.Active)
    expect(student.enrollmentDate).toEqual(new Date('2026-09-01'))
    expect(student.fullName).toBe('Alice Smith')
  })

  it('throws DomainValidationError when id is blank', () => {
    expect(() => {
      new Student({
        id: '  ',
        schoolId: 'school-1',
        firstName: 'Alice',
        lastName: 'Smith',
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when schoolId is blank', () => {
    expect(() => {
      new Student({
        id: 'student-1',
        schoolId: '',
        firstName: 'Alice',
        lastName: 'Smith',
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when firstName is blank', () => {
    expect(() => {
      new Student({
        id: 'student-1',
        schoolId: 'school-1',
        firstName: ' \t ',
        lastName: 'Smith',
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when lastName is blank', () => {
    expect(() => {
      new Student({
        id: 'student-1',
        schoolId: 'school-1',
        firstName: 'Alice',
        lastName: '',
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when optional string inputs are blank', () => {
    expect(() => {
      new Student({
        id: 'student-1',
        schoolId: 'school-1',
        firstName: 'Alice',
        lastName: 'Smith',
        gender: '  ',
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when enrollmentDate is invalid', () => {
    expect(() => {
      new Student({
        id: 'student-1',
        schoolId: 'school-1',
        firstName: 'Alice',
        lastName: 'Smith',
        enrollmentDate: new Date('invalid date string'),
      })
    }).toThrow(DomainValidationError)
  })
})
