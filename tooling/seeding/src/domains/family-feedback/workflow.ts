import type { FixtureDataset } from '@edaya/fixtures'
import type { FamilyFeedbackSeedPort } from './port'

export interface DevFamilyFeedbackSeedCounts {
  campaigns: number
}

export async function seedDevFamilyFeedback(
  port: FamilyFeedbackSeedPort,
  dataset: FixtureDataset,
): Promise<DevFamilyFeedbackSeedCounts> {
  const existing = await port.listCampaigns()
  if (existing.length > 0) {
    return { campaigns: 0 }
  }

  const academicYearId = dataset.entities.academicYear?.id
  const period = dataset.entities.academicPeriods?.[0]
  if (!academicYearId || !period) {
    return { campaigns: 0 }
  }

  const assignments = await port.listSubjectAssignments(academicYearId)
  if (assignments.length === 0) {
    return { campaigns: 0 }
  }

  const staff = await port.listStaffMembers()
  const assignment = assignments[0]
  if (!assignment) {
    return { campaigns: 0 }
  }
  const moderator = staff.find(member => member.id !== assignment.teacherId) ?? staff[0]

  await port.createCampaign({
    requestId: `dev-family-feedback-seed:${dataset.schoolId}`,
    id: `ff-campaign-${dataset.schoolId}`,
    academicYearId,
    academicPeriodId: period.id,
    teacherAssignmentId: assignment.id,
    moderatorStaffId: moderator?.id,
  })

  return { campaigns: 1 }
}
