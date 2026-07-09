import { demoCiDataset, demoDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { buildFixtureCurriculumPlan, classSubjectMatterSeedId } from './curriculum-plan'

describe('buildFixtureCurriculumPlan', () => {
  test('links every subject matter chapter to each class subject offering', () => {
    const plan = buildFixtureCurriculumPlan(demoCiDataset.entities)
    const mathMatters = (demoCiDataset.entities.subjectMatters ?? [])
      .filter(matter => matter.subjectId === 'ci-subj-math')

    expect(mathMatters.length).toBeGreaterThan(1)
    expect(plan.gradeLevelSubjectMatters.length).toBeGreaterThan(
      plan.gradeLevelSubjects.length,
    )

    const mathGradeLevelSubject = plan.gradeLevelSubjects.find(
      entry => entry.subjectId === 'ci-subj-math' && entry.gradeLevelId === 'ci-gl-6',
    )
    expect(mathGradeLevelSubject).toBeDefined()

    const mathLinks = plan.gradeLevelSubjectMatters.filter(
      link => link.gradeLevelSubjectId === mathGradeLevelSubject?.id,
    )
    expect(mathLinks).toHaveLength(mathMatters.length)
    expect(mathLinks[0]?.classSubjectMatterIdsByClassGroupId['ci-6a']).toBe(
      classSubjectMatterSeedId('ci-cs-6a-math', mathMatters[0]!.id),
    )
  })

  test('central demo exposes multiple math chapters for 6a', () => {
    const plan = buildFixtureCurriculumPlan(demoDataset.entities)
    const mathMatters = (demoDataset.entities.subjectMatters ?? [])
      .filter(matter => matter.subjectId === 'subj-math')

    expect(mathMatters.map(matter => matter.name)).toContain('Introduction to algebra')

    const mathLinks = plan.gradeLevelSubjectMatters.filter(
      link => link.subjectMatterId.startsWith('sm-math-'),
    )
    expect(mathLinks.length).toBeGreaterThanOrEqual(mathMatters.length)
  })
})
