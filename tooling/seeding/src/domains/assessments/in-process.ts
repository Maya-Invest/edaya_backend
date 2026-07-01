import type { SeedApplication } from '../../support/types'
import type { AssessmentsSeedPort } from './port'
import { createInProcessSeedService } from '../../support/in-process-seed-service'
import { withSeedPortError } from '../../support/seed-port-error'

export function createInProcessAssessmentsSeedPort(
  application: SeedApplication,
): AssessmentsSeedPort {
  const service = createInProcessSeedService(application, 'dev-assessments-seed')

  return {
    createAssessment: record => withSeedPortError('assessments.createAssessment', async () => {
      await service.assessmentsWorkflow.createAssessment({
        ...record,
        date: new Date(record.date),
        dueAt: new Date(record.dueAt),
      })
    }),
    recordAssessmentResult: record => withSeedPortError('assessments.recordAssessmentResult', async () => {
      await service.assessmentsWorkflow.recordAssessmentResult(record)
    }),
  }
}
