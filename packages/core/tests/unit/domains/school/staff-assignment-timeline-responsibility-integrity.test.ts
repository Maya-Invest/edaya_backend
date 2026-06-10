import { describe, expect, it } from 'bun:test'
import { StaffAssignment } from '../../../../src/domains/school/staff-assignment'

describe('StaffAssignment entity timeline and responsibility integrity', () => {
  const baseArgs = {
    id: 'assignment-1',
    staffId: 'staff-1',
    responsibility: 'teacher',
  }

  it('instantiates successfully when targeting exactly classGroupId', () => {
    const assignment = new StaffAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
    })

    expect(assignment.id).toBe('assignment-1')
    expect(assignment.staffId).toBe('staff-1')
    expect(assignment.responsibility).toBe('teacher')
    expect(assignment.classGroupId).toBe('class-1')
    expect(assignment.classSubjectId).toBeUndefined()
    expect(assignment.sessionId).toBeUndefined()
    expect(assignment.createdAt).toBeInstanceOf(Date)
  })

  it('instantiates successfully when targeting exactly classSubjectId', () => {
    const assignment = new StaffAssignment({
      ...baseArgs,
      classSubjectId: 'subject-1',
    })

    expect(assignment.classSubjectId).toBe('subject-1')
    expect(assignment.classGroupId).toBeUndefined()
    expect(assignment.sessionId).toBeUndefined()
  })

  it('instantiates successfully when targeting exactly sessionId', () => {
    const assignment = new StaffAssignment({
      ...baseArgs,
      sessionId: 'session-1',
    })

    expect(assignment.sessionId).toBe('session-1')
    expect(assignment.classGroupId).toBeUndefined()
    expect(assignment.classSubjectId).toBeUndefined()
  })

  it('throws error when multiple targets are provided', () => {
    expect(() => new StaffAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
      classSubjectId: 'subject-1',
    })).toThrow('A StaffAssignment must target exactly one of: classGroupId, classSubjectId, or sessionId')

    expect(() => new StaffAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
      sessionId: 'session-1',
    })).toThrow('A StaffAssignment must target exactly one of: classGroupId, classSubjectId, or sessionId')

    expect(() => new StaffAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
      classSubjectId: 'subject-1',
      sessionId: 'session-1',
    })).toThrow('A StaffAssignment must target exactly one of: classGroupId, classSubjectId, or sessionId')
  })

  it('throws error when no targets are provided', () => {
    expect(() => new StaffAssignment(baseArgs)).toThrow('A StaffAssignment must target exactly one of: classGroupId, classSubjectId, or sessionId')
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new StaffAssignment({ ...baseArgs, id: '', classGroupId: 'class-1' })).toThrow()
    expect(() => new StaffAssignment({ ...baseArgs, staffId: ' \t ', classGroupId: 'class-1' })).toThrow()
    expect(() => new StaffAssignment({ ...baseArgs, responsibility: '', classGroupId: 'class-1' })).toThrow()
  })
})
