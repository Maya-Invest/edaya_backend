import { Resource, ResourceKind } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('Resource allocation bounds and kind validation', () => {
  const baseArgs = {
    id: 'resource-room',
    schoolId: 'school-1',
    name: 'Classroom 101',
    kind: ResourceKind.Location,
  }

  it('instantiates successfully with valid inputs and defaults', () => {
    const resource = new Resource(baseArgs)

    expect(resource.id).toBe('resource-room')
    expect(resource.schoolId).toBe('school-1')
    expect(resource.name).toBe('Classroom 101')
    expect(resource.kind).toBe(ResourceKind.Location)
    expect(resource.createdAt).toBeInstanceOf(Date)
    expect(resource.description).toBeUndefined()
    expect(resource.capacity).toBeUndefined()
  })

  it('handles optional parameters correctly', () => {
    const createdDate = new Date()
    const resource = new Resource({
      ...baseArgs,
      description: '   Main Science Lab   ',
      capacity: 30,
      createdAt: createdDate,
    })

    expect(resource.description).toBe('Main Science Lab')
    expect(resource.capacity).toBe(30)
    expect(resource.createdAt.getTime()).toBe(createdDate.getTime())
  })

  it('throws error when non-blank fields are empty or invalid', () => {
    expect(() => new Resource({ ...baseArgs, id: ' ' })).toThrow()
    expect(() => new Resource({ ...baseArgs, schoolId: '' })).toThrow()
    expect(() => new Resource({ ...baseArgs, name: ' \t ' })).toThrow()
  })

  it('throws error when optional capacity is zero or negative', () => {
    expect(() => new Resource({ ...baseArgs, capacity: 0 })).toThrow()
    expect(() => new Resource({ ...baseArgs, capacity: -5 })).toThrow()
  })

  it('does not define description when empty or whitespace description is provided', () => {
    const resource = new Resource({
      ...baseArgs,
      description: '   ',
    })
    expect(resource.description).toBeUndefined()
  })
})
