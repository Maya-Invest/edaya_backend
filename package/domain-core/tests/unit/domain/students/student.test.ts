import { describe, expect, test } from 'bun:test'
import { Student, StudentStatus } from '../../../../src/domain/students/student'

describe('Student copyWith', () => {
  const baseArgs = {
    id: 'stu1',
    schoolId: 'sch1',
    firstName: 'Alice',
    lastName: 'Smith',
    gender: 'Female',
    birthDate: new Date('2010-01-01'),
    status: StudentStatus.Active,
  }

  test('copies successfully using copyWith', () => {
    const student = new Student(baseArgs)
    const newStatus = StudentStatus.Inactive
    const updated = student.copyWith({
      status: newStatus,
      firstName: 'Alicia',
    })

    expect(updated.id).toBe('stu1')
    expect(updated.firstName).toBe('Alicia')
    expect(updated.status).toBe(StudentStatus.Inactive)
    expect(updated.lastName).toBe('Smith')
    expect(updated.gender).toBe('Female')
  })
})
