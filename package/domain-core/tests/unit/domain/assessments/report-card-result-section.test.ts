import { describe, expect, test } from 'bun:test'
import { ReportCardDefinitionSectionKind } from '../../../../src/domain/assessments/report-card-definition-section'
import { ReportCardResultSection } from '../../../../src/domain/assessments/report-card-result-section'

describe('ReportCardResultSection entity', () => {
  test('instantiates successfully as a group section', () => {
    const result = new ReportCardResultSection({
      sectionId: 'sec1',
      sectionKind: ReportCardDefinitionSectionKind.Group,
      name: 'Sciences',
      average: 14.5,
      weight: 1,
      parentSectionId: 'parent1',
    })

    expect(result.sectionId).toBe('sec1')
    expect(result.sectionKind).toBe(ReportCardDefinitionSectionKind.Group)
    expect(result.name).toBe('Sciences')
    expect(result.average).toBe(14.5)
    expect(result.weight).toBe(1)
    expect(result.parentSectionId).toBe('parent1')
    expect(result.classSubjectId).toBeUndefined()
    expect(result.subResults).toEqual([])
  })

  test('instantiates successfully as a subject section', () => {
    const result = new ReportCardResultSection({
      sectionId: 'sec2',
      sectionKind: ReportCardDefinitionSectionKind.Subject,
      name: 'Physics',
      average: 12.333,
      weight: 2,
      classSubjectId: 'csub1',
    })

    expect(result.sectionId).toBe('sec2')
    expect(result.sectionKind).toBe(ReportCardDefinitionSectionKind.Subject)
    expect(result.name).toBe('Physics')
    expect(result.average).toBe(12.33) // Rounded
    expect(result.weight).toBe(2)
    expect(result.classSubjectId).toBe('csub1')
  })

  test('persists teacher comment on subject sections', () => {
    const result = new ReportCardResultSection({
      sectionId: 'sec3',
      sectionKind: ReportCardDefinitionSectionKind.Subject,
      name: 'subj-math',
      average: 18.5,
      weight: 2,
      classSubjectId: 'cs-6a-math',
      comment: 'Excellent — maîtrise remarquable de l\'algèbre.',
    })

    expect(result.comment).toBe('Excellent — maîtrise remarquable de l\'algèbre.')
  })

  test('throws error if group section references a class subject', () => {
    expect(() => {
      new ReportCardResultSection({
        sectionId: 'sec1',
        sectionKind: ReportCardDefinitionSectionKind.Group,
        name: 'Sciences',
        average: 14.5,
        weight: 1,
        classSubjectId: 'csub1',
      })
    }).toThrow('group section results must not reference a class subject')
  })

  test('throws error if subject section does not reference a class subject', () => {
    expect(() => {
      new ReportCardResultSection({
        sectionId: 'sec2',
        sectionKind: ReportCardDefinitionSectionKind.Subject,
        name: 'Physics',
        average: 12.33,
        weight: 2,
      })
    }).toThrow('subject section results must reference a class subject')
  })

  test('throws DomainValidationError if average or weight are negative', () => {
    expect(() => {
      new ReportCardResultSection({
        sectionId: 'sec1',
        sectionKind: ReportCardDefinitionSectionKind.Group,
        name: 'Sciences',
        average: -1,
        weight: 1,
      })
    }).toThrow('average must be a finite, non-negative number')

    expect(() => {
      new ReportCardResultSection({
        sectionId: 'sec1',
        sectionKind: ReportCardDefinitionSectionKind.Group,
        name: 'Sciences',
        average: 10,
        weight: -1,
      })
    }).toThrow('weight must be a finite, non-negative number')
  })
})
