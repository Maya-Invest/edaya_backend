import type { SeedApplication } from '../../../support/types'
import type { AssessmentsSeedPort } from '../port'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessAssessmentsSeedPort(
  application: SeedApplication,
): AssessmentsSeedPort {
  const service = createInProcessSeedService(application, 'dev-assessments-seed')

  return {
    createAssessment: record => withSeedPortError('assessments.createAssessment', async () => {
      await service.assessmentsWorkflow.createAssessment({
        ...record,
        ...(record.dueAt ? { dueAt: new Date(record.dueAt) } : {}),
        ...(record.completedAt ? { completedAt: new Date(record.completedAt) } : {}),
        ...(record.startsAt ? { startsAt: new Date(record.startsAt) } : {}),
        ...(record.endsAt ? { endsAt: new Date(record.endsAt) } : {}),
        attachments: record.attachments?.map(attachment => ({ ...attachment })),
      })
    }),
    recordAssessmentResult: record => withSeedPortError('assessments.recordAssessmentResult', async () => {
      await service.assessmentsWorkflow.recordAssessmentResult(record)
    }),
  }
}
