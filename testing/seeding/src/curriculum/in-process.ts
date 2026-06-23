import type { SeedApplication } from '../types'
import type { CurriculumSeedPort } from './port'
import { Subject, SubjectMatter } from '@edaya/core'
import { createInProcessSeedService } from '../in-process-seed-service'
import { withSeedPortError } from '../seed-port-error'

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
    offerSubjectToClass: record => withSeedPortError('curriculum.offerSubjectToClass', async () => {
      await service.academicsWorkflow.offerSubjectToClass(record)
    }),
    assignMatterToClassSubject: record => withSeedPortError('curriculum.assignMatterToClassSubject', async () => {
      await service.academicsWorkflow.assignMatterToClassSubject(record)
    }),
  }
}
