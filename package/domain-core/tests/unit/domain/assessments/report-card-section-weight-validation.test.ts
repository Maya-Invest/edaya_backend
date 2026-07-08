import { DomainValidationError, ReportCardDefinitionSection, ReportCardDefinitionSectionKind } from '@edaya/core'
import { describe, expect, it } from 'bun:test'

describe('Report card definition section type validations', () => {
  const baseArgs = {
    id: 'section-1',
    reportCardDefinitionId: 'definition-1',
    name: 'Mathematics Section',
    order: 1,
    weight: 20,
  }

  it('instantiates group section successfully without subjectId', () => {
    const section = new ReportCardDefinitionSection({
      ...baseArgs,
      kind: ReportCardDefinitionSectionKind.Group,
    })
    expect(section.kind).toBe(ReportCardDefinitionSectionKind.Group)
    expect(section.subjectId).toBeUndefined()
  })

  it('throws error when group section has a subjectId', () => {
    expect(() => {
      new ReportCardDefinitionSection({
        ...baseArgs,
        kind: ReportCardDefinitionSectionKind.Group,
        subjectId: 'subject-1',
      })
    }).toThrow('group report card sections must not reference a subject')
  })

  it('instantiates subject section successfully with subjectId', () => {
    const section = new ReportCardDefinitionSection({
      ...baseArgs,
      kind: ReportCardDefinitionSectionKind.Subject,
      subjectId: 'subject-1',
    })
    expect(section.kind).toBe(ReportCardDefinitionSectionKind.Subject)
    expect(section.subjectId).toBe('subject-1')
  })

  it('throws error when subject section has no subjectId', () => {
    expect(() => {
      new ReportCardDefinitionSection({
        ...baseArgs,
        kind: ReportCardDefinitionSectionKind.Subject,
      })
    }).toThrow('subject report card sections must reference a subject')
  })

  it('throws DomainValidationError when weight is non-positive', () => {
    expect(() => {
      new ReportCardDefinitionSection({
        ...baseArgs,
        weight: 0,
      })
    }).toThrow(DomainValidationError)
  })

  it('throws DomainValidationError when order is non-positive integer', () => {
    expect(() => {
      new ReportCardDefinitionSection({
        ...baseArgs,
        order: -5,
      })
    }).toThrow(DomainValidationError)
  })

  it('copies with copyWith correctly', () => {
    const section = new ReportCardDefinitionSection({
      ...baseArgs,
      kind: ReportCardDefinitionSectionKind.Subject,
      subjectId: 'subject-1',
    })
    const updated = section.copyWith({
      name: 'Advanced Maths',
      weight: 35,
    })
    expect(updated.name).toBe('Advanced Maths')
    expect(updated.weight).toBe(35)
    expect(updated.subjectId).toBe('subject-1')
  })
})
