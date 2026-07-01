import { describe, expect, it } from 'bun:test'
import { StaffAssignment } from '../../../../src/domain/school/staff-assignment'

const targetError = 'A StaffAssignment must target exactly one of: classGroupId, classSubjectId, lessonSessionId, activitySessionId, or assessmentId'

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
    expect(assignment.lessonSessionId).toBeUndefined()
    expect(assignment.createdAt).toBeInstanceOf(Date)
  })

  it('instantiates successfully when targeting exactly classSubjectId', () => {
    const assignment = new StaffAssignment({
      ...baseArgs,
      classSubjectId: 'subject-1',
    })

    expect(assignment.classSubjectId).toBe('subject-1')
    expect(assignment.classGroupId).toBeUndefined()
    expect(assignment.lessonSessionId).toBeUndefined()
  })

  it('instantiates successfully when targeting exactly lessonSessionId', () => {
    const assignment = new StaffAssignment({
      ...baseArgs,
      lessonSessionId: 'session-1',
    })

    expect(assignment.lessonSessionId).toBe('session-1')
    expect(assignment.classGroupId).toBeUndefined()
    expect(assignment.classSubjectId).toBeUndefined()
  })

  it('throws error when multiple targets are provided', () => {
    expect(() => new StaffAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
      classSubjectId: 'subject-1',
    })).toThrow(targetError)

    expect(() => new StaffAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
      lessonSessionId: 'session-1',
    })).toThrow(targetError)

    expect(() => new StaffAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
      classSubjectId: 'subject-1',
      lessonSessionId: 'session-1',
    })).toThrow(targetError)
  })

  it('throws error when no targets are provided', () => {
    expect(() => new StaffAssignment(baseArgs)).toThrow(targetError)
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new StaffAssignment({ ...baseArgs, id: '', classGroupId: 'class-1' })).toThrow()
    expect(() => new StaffAssignment({ ...baseArgs, staffId: ' \t ', classGroupId: 'class-1' })).toThrow()
    expect(() => new StaffAssignment({ ...baseArgs, responsibility: '', classGroupId: 'class-1' })).toThrow()
  })
})
