import type { SeedApplication } from '../../support/types'
import type { LearningContentSeedPort } from './port'
import { ClassLogbookEntry, HomeworkAssignment, HomeworkSubmission } from '@edaya/core'
import { createInProcessSeedService } from '../../support/in-process-seed-service'
import { withSeedPortError } from '../../support/seed-port-error'

export function createInProcessLearningContentSeedPort(
  application: SeedApplication,
): LearningContentSeedPort {
  const service = createInProcessSeedService(application, 'dev-learning-content-seed')

  return {
    saveHomeworkAssignment: record => withSeedPortError('learningContent.saveHomeworkAssignment', async () => {
      await service.baseService.entities.homeworkAssignments.save(new HomeworkAssignment({
        ...record,
        dueDate: new Date(record.dueDate),
        assignedDate: new Date(record.assignedDate),
        attachments: record.attachments.map(attachment => ({ ...attachment })),
      }), { moduleChecked: true })
    }),
    saveHomeworkSubmission: record => withSeedPortError('learningContent.saveHomeworkSubmission', async () => {
      await service.baseService.entities.homeworkSubmissions.save(new HomeworkSubmission({
        ...record,
        submittedAt: record.submittedAt ? new Date(record.submittedAt) : undefined,
      }), { moduleChecked: true })
    }),
    saveClassLogbookEntry: record => withSeedPortError('learningContent.saveClassLogbookEntry', async () => {
      await service.baseService.entities.classLogbookEntries.save(new ClassLogbookEntry({
        ...record,
        date: new Date(record.date),
        objectives: [...record.objectives],
        attachments: [...record.attachments],
      }), { moduleChecked: true })
    }),
  }
}
