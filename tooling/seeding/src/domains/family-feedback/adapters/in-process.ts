import type { SeedApplication } from '../../../support/types'
import type { FamilyFeedbackSeedPort } from '../port'
import { TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

export function createInProcessFamilyFeedbackSeedPort(
  application: SeedApplication,
): FamilyFeedbackSeedPort {
  const service = createInProcessSeedService(application, 'dev-family-feedback-seed')

  return {
    listSubjectAssignments: academicYearId => withSeedPortError('familyFeedback.listSubjectAssignments', async () => {
      const rows = await service.baseService.entities.teacherAssignments.list({
        academicYearId,
        kind: TeacherAssignmentKind.Subject,
        status: TeacherAssignmentStatus.Active,
      })
      return rows.map(row => ({ id: row.id, teacherId: row.teacherId }))
    }),
    listStaffMembers: () => withSeedPortError('familyFeedback.listStaffMembers', async () => {
      const rows = await service.baseService.entities.staffMembers.list({ accountKind: 'human' })
      return rows.map(row => ({ id: row.id }))
    }),
    listCampaigns: () => withSeedPortError('familyFeedback.listCampaigns', async () => {
      const rows = await service.familyFeedbackWorkflow.listFamilyFeedbackCampaigns()
      return rows.map(row => ({ id: row.id, status: row.status }))
    }),
    createCampaign: record => withSeedPortError('familyFeedback.createCampaign', async () => {
      await service.familyFeedbackWorkflow.createFamilyFeedbackCampaign(record)
    }),
  }
}
