import type { FixtureDatasetEntities } from '@edaya/fixtures'

export interface FixtureCurriculumGradeLevelSubject {
  id: string
  gradeLevelId: string
  academicYearId: string
  subjectId: string
  coefficient?: number
  classSubjectIdsByClassGroupId: Record<string, string>
}

export interface FixtureCurriculumGradeLevelSubjectMatter {
  id: string
  gradeLevelSubjectId: string
  subjectMatterId: string
  classSubjectMatterIdsByClassGroupId: Record<string, string>
}

function gradeLevelSubjectSeedId(gradeLevelId: string, subjectId: string): string {
  return `gls-${gradeLevelId}-${subjectId.replace('subj-', '')}`
}

export function buildFixtureCurriculumPlan(
  entities: FixtureDatasetEntities,
): {
  gradeLevelSubjects: readonly FixtureCurriculumGradeLevelSubject[]
  gradeLevelSubjectMatters: readonly FixtureCurriculumGradeLevelSubjectMatter[]
} {
  const classGroups = entities.classGroups ?? []
  const classSubjects = entities.classSubjects ?? []
  const subjectMatters = entities.subjectMatters ?? []
  const academicYearId = entities.academicYear?.id
  if (!academicYearId) {
    throw new Error('Fixture dataset must include academicYear to build curriculum plan')
  }

  const classGradeLevelById = Object.fromEntries(
    classGroups.map(classGroup => [classGroup.id, classGroup.gradeLevelId]),
  )
  const subjectMatterBySubjectId = Object.fromEntries(
    subjectMatters.map(matter => [matter.subjectId, matter.id]),
  )

  const gradeLevelSubjects: FixtureCurriculumGradeLevelSubject[] = []
  const classSubjectIdsByGradeLevelSubjectId: Record<string, Record<string, string>> = {}
  const seenGradeLevelSubjects = new Set<string>()

  for (const offering of classSubjects) {
    const gradeLevelId = classGradeLevelById[offering.classGroupId]
    if (!gradeLevelId) {
      continue
    }
    const gradeLevelSubjectId = gradeLevelSubjectSeedId(gradeLevelId, offering.subjectId)
    if (!seenGradeLevelSubjects.has(gradeLevelSubjectId)) {
      seenGradeLevelSubjects.add(gradeLevelSubjectId)
      gradeLevelSubjects.push({
        id: gradeLevelSubjectId,
        gradeLevelId,
        academicYearId,
        subjectId: offering.subjectId,
        coefficient: offering.coefficient ?? undefined,
        classSubjectIdsByClassGroupId: {},
      })
      classSubjectIdsByGradeLevelSubjectId[gradeLevelSubjectId] = {}
    }
    classSubjectIdsByGradeLevelSubjectId[gradeLevelSubjectId]![offering.classGroupId] = offering.id
  }

  for (const gradeLevelSubject of gradeLevelSubjects) {
    gradeLevelSubject.classSubjectIdsByClassGroupId = {
      ...classSubjectIdsByGradeLevelSubjectId[gradeLevelSubject.id],
    }
  }

  const gradeLevelSubjectMatters = gradeLevelSubjects.flatMap((gradeLevelSubject) => {
    const subjectMatterId = subjectMatterBySubjectId[gradeLevelSubject.subjectId]
    if (!subjectMatterId) {
      return []
    }
    const classSubjectMatterIdsByClassGroupId = Object.fromEntries(
      Object.entries(gradeLevelSubject.classSubjectIdsByClassGroupId).map(([classGroupId, classSubjectId]) => [
        classGroupId,
        `csm-${classSubjectId}`,
      ]),
    )
    return [{
      id: `glsm-${gradeLevelSubject.id}`,
      gradeLevelSubjectId: gradeLevelSubject.id,
      subjectMatterId,
      classSubjectMatterIdsByClassGroupId,
    }]
  })

  return {
    gradeLevelSubjects,
    gradeLevelSubjectMatters,
  }
}
