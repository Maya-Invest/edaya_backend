import type { SeedApplication } from '../../../support/types'
import type { CurriculumSeedPort } from '../port'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessCurriculumSeedPort(
  application: SeedApplication,
): CurriculumSeedPort {
  const service = createInProcessSeedService(application, 'dev-curriculum-seed')

  return {
    saveSubjectCategory: record => withSeedPortError('curriculum.saveSubjectCategory', async () => {
      await service.academicsWorkflow.configureSubjectCategory(record)
    }),
    saveAcademicDiscipline: record => withSeedPortError('curriculum.saveAcademicDiscipline', async () => {
      await service.academicsWorkflow.configureAcademicDiscipline(record)
    }),
    saveSubject: record => withSeedPortError('curriculum.saveSubject', async () => {
      await service.academicsWorkflow.configureSubject(record)
    }),
    saveSubjectMatter: record => withSeedPortError('curriculum.saveSubjectMatter', async () => {
      await service.academicsWorkflow.configureSubjectMatter(record)
    }),
  }
}
