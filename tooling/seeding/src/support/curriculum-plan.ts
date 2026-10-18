import type { FixtureDatasetEntities } from '@edaya/fixtures'

export function classSubjectMatterSeedId(classSubjectId: string, subjectMatterId: string): string {
  return `csm-${classSubjectId}-${subjectMatterId}`
}

export function buildFixtureCurriculumPlan(entities: FixtureDatasetEntities) {
  if (!entities.academicYear)
    throw new Error('Fixture dataset must include academicYear to build curriculum plan')
  const subjects = (entities.subjects ?? []).map(subject => ({ ...subject, classSubjectIdsByClassGroupId: Object.fromEntries((entities.classSubjects ?? [])
    .filter(offering => offering.subjectId === subject.id).map(offering => [offering.classGroupId, offering.id])) }))
  const subjectMatters = entities.subjectMatters ?? []
  return { subjects, subjectMatters, classSubjectMatterCount: (entities.classSubjects ?? []).reduce((count, offering) => count + subjectMatters.filter(chapter => chapter.subjectId === offering.subjectId).length, 0) }
}
