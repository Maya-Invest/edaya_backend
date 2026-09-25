import { demoCiDataset } from '@edaya/fixtures'
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
    const frenchGradeLevelSubject = plan.gradeLevelSubjects.find(
      entry => entry.subjectId === 'ci-subj-fr' && entry.gradeLevelId === 'ci-gl-6',
    )
    expect(frenchGradeLevelSubject?.periodsPerWeek).toBe(4)
  })
})
