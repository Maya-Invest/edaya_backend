import type { FixtureDataset } from '@edaya/fixtures'
import type { CurriculumSeedPort } from './port'
import { buildFixtureCurriculumPlan } from '../../support/curriculum-plan'

export async function seedDevCurriculum(port: CurriculumSeedPort, dataset: FixtureDataset): Promise<void> {
  const plan = buildFixtureCurriculumPlan(dataset.entities)
  for (const discipline of dataset.entities.academicDisciplines ?? [])
    await port.saveAcademicDiscipline(discipline)
  for (const subject of plan.subjects)
    await port.saveSubject(subject)
  for (const matter of plan.subjectMatters)
    await port.saveSubjectMatter(matter)
}
