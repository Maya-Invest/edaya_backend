import { demoCiDataset } from '@edaya/fixtures'
import { expect, test } from 'bun:test'
import { buildFixtureCurriculumPlan, classSubjectMatterSeedId } from './curriculum-plan'

test('plans each grade subject once, preserving class and chapter identities', () => {
  const plan = buildFixtureCurriculumPlan(demoCiDataset.entities)
  const math = plan.subjects.find(subject => subject.id === 'ci-subj-math')!
  expect(math.gradeLevelId).toBe('ci-gl-6')
  expect(math.classSubjectIdsByClassGroupId['ci-6a']).toBe('ci-cs-6a-math')
  expect(math.classSubjectIdsByClassGroupId['ci-6b']).toBe('ci-cs-6b-math')
  const chapters = plan.subjectMatters.filter(chapter => chapter.subjectId === math.id)
  expect(chapters.length).toBeGreaterThan(1)
  expect(classSubjectMatterSeedId('ci-cs-6a-math', chapters[0]!.id)).toBe(`csm-ci-cs-6a-math-${chapters[0]!.id}`)
  expect(plan.classSubjectMatterCount).toBeGreaterThan(plan.subjectMatters.length)
  expect(plan.subjects.find(subject => subject.id === 'ci-subj-fr')?.periodsPerWeek).toBe(4)
})
