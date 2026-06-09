import { describe, expect, it } from 'bun:test'
import { SubjectMatter } from '../../../../src/domains/academics/subject-matter'

describe('SubjectMatter entity validation and sequence', () => {
  it('instantiates successfully with valid inputs', () => {
    const createdDate = new Date()
    const subjectMatter = new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      description: 'Introduction to algebra',
      sequenceOrder: 1,
      estimatedHours: 5,
      createdAt: createdDate,
    })

    expect(subjectMatter.id).toBe('matter-1')
    expect(subjectMatter.subjectId).toBe('subject-1')
    expect(subjectMatter.name).toBe('Algebra')
    expect(subjectMatter.description).toBe('Introduction to algebra')
    expect(subjectMatter.sequenceOrder).toBe(1)
    expect(subjectMatter.estimatedHours).toBe(5)
    expect(subjectMatter.createdAt).toBe(createdDate)
  })

  it('sets default createdAt when omitted', () => {
    const subjectMatter = new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 1,
    })

    expect(subjectMatter.createdAt).toBeInstanceOf(Date)
    expect(subjectMatter.description).toBeUndefined()
    expect(subjectMatter.estimatedHours).toBeUndefined()
  })

  it('throws error when non-blank fields are empty', () => {
    expect(() => new SubjectMatter({
      id: ' ',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 1,
    })).toThrow()

    expect(() => new SubjectMatter({
      id: 'matter-1',
      subjectId: '',
      name: 'Algebra',
      sequenceOrder: 1,
    })).toThrow()

    expect(() => new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: ' \t',
      sequenceOrder: 1,
    })).toThrow()
  })

  it('throws error when sequenceOrder is negative or zero', () => {
    expect(() => new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 0,
    })).toThrow()

    expect(() => new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: -1,
    })).toThrow()
  })

  it('throws error when optional fields are empty or negative', () => {
    expect(() => new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 1,
      description: ' \n ',
    })).toThrow()

    expect(() => new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 1,
      estimatedHours: -2,
    })).toThrow()
  })
})
