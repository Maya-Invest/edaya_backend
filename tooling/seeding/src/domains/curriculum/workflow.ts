import type { FixtureDataset } from '@edaya/fixtures'
import type { CurriculumSeedPort } from './port'
import { buildFixtureCurriculumPlan } from '../../support/curriculum-plan'

export async function seedDevCurriculum(
  port: CurriculumSeedPort,
  dataset: FixtureDataset,
): Promise<void> {
  const subjects = dataset.entities.subjects ?? []
  const subjectMatters = dataset.entities.subjectMatters ?? []
  const curriculumPlan = buildFixtureCurriculumPlan(dataset.entities)

  for (const subject of subjects) {
    if (!subject.category || !subject.color) {
      throw new Error(`Fixture subject ${subject.id} must include category and color`)
    }
    await port.saveSubject({
      id: subject.id,
      schoolId: dataset.schoolId,
      name: subject.name,
      code: subject.code ?? undefined,
      defaultCoefficient: subject.defaultCoefficient ?? undefined,
      category: subject.category,
      color: subject.color,
    })
  }

  for (const matter of subjectMatters) {
    await port.saveSubjectMatter({
      id: matter.id,
      subjectId: matter.subjectId,
      name: matter.name,
      description: matter.description ?? undefined,
      sequenceOrder: matter.sequenceOrder,
      estimatedHours: matter.estimatedHours ?? undefined,
    })
  }

  for (const offering of curriculumPlan.gradeLevelSubjects) {
    await port.offerSubjectToGradeLevel({
      id: offering.id,
      gradeLevelId: offering.gradeLevelId,
      academicYearId: offering.academicYearId,
      subjectId: offering.subjectId,
      coefficient: offering.coefficient,
      classSubjectIdsByClassGroupId: offering.classSubjectIdsByClassGroupId,
    })
  }

  for (const link of curriculumPlan.gradeLevelSubjectMatters) {
    await port.assignMatterToGradeLevelSubject({
      id: link.id,
      gradeLevelSubjectId: link.gradeLevelSubjectId,
      subjectMatterId: link.subjectMatterId,
      classSubjectMatterIdsByClassGroupId: link.classSubjectMatterIdsByClassGroupId,
    })
  }
}
