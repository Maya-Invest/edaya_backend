import { describe, expect, it } from 'bun:test'
import { ResourceAssignment } from '../../../../src/domains/school/resource-assignment'
import { DomainValidationError } from '../../../../src/domains/utils'

describe('ResourceAssignment target bounds and validation', () => {
  const baseArgs = {
    id: 'assignment-1',
    resourceId: 'resource-1',
  }

  it('instantiates successfully with classGroupId only', () => {
    const assignment = new ResourceAssignment({
      ...baseArgs,
      classGroupId: 'class-1',
    })

    expect(assignment.id).toBe('assignment-1')
    expect(assignment.resourceId).toBe('resource-1')
    expect(assignment.classGroupId).toBe('class-1')
    expect(assignment.sessionId).toBeUndefined()
    expect(assignment.createdAt).toBeInstanceOf(Date)
  })

  it('instantiates successfully with sessionId only', () => {
    const assignment = new ResourceAssignment({
      ...baseArgs,
      sessionId: 'session-1',
    })

    expect(assignment.sessionId).toBe('session-1')
    expect(assignment.classGroupId).toBeUndefined()
  })

  it('throws DomainValidationError when both targets are provided', () => {
    expect(() => {
      new ResourceAssignment({
        ...baseArgs,
        classGroupId: 'class-1',
        sessionId: 'session-1',
      })
    }).toThrow('A ResourceAssignment must target exactly one of: sessionId or classGroupId')
  })

  it('throws DomainValidationError when no targets are provided', () => {
    expect(() => {
      new ResourceAssignment(baseArgs)
    }).toThrow('A ResourceAssignment must target exactly one of: sessionId or classGroupId')
  })

  it('throws DomainValidationError when id or resourceId is blank', () => {
    expect(() => {
      new ResourceAssignment({
        ...baseArgs,
        id: '   ',
        classGroupId: 'class-1',
      })
    }).toThrow(DomainValidationError)

    expect(() => {
      new ResourceAssignment({
        ...baseArgs,
        resourceId: '',
        classGroupId: 'class-1',
      })
    }).toThrow(DomainValidationError)
  })
})
