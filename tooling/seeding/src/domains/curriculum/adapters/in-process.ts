import type { SeedApplication } from '../../../support/types'
import type { CurriculumSeedPort } from '../port'
import { Subject, SubjectMatter } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessCurriculumSeedPort(
  application: SeedApplication,
): CurriculumSeedPort {
  const service = createInProcessSeedService(application, 'dev-curriculum-seed')

  return {
    saveSubject: record => withSeedPortError('curriculum.saveSubject', async () => {
      await service.baseService.entities.subjects.save(new Subject(record), { moduleChecked: true })
    }),
    saveSubjectMatter: record => withSeedPortError('curriculum.saveSubjectMatter', async () => {
      await service.baseService.entities.subjectMatters.save(new SubjectMatter(record), { moduleChecked: true })
    }),
    offerSubjectToGradeLevel: record => withSeedPortError('curriculum.offerSubjectToGradeLevel', async () => {
      await service.academicsWorkflow.offerSubjectToGradeLevel(record)
    }),
    assignMatterToGradeLevelSubject: record => withSeedPortError('curriculum.assignMatterToGradeLevelSubject', async () => {
      await service.academicsWorkflow.assignMatterToGradeLevelSubject(record)
    }),
  }
}
