import type { FixtureDataset } from '@edaya/fixtures'
import type { FamilyFeedbackSeedPort } from './port'

export interface DevFamilyFeedbackSeedCounts {
  campaigns: number
}

function moderatorStaffIdForDataset(_dataset: FixtureDataset): string {
  return 'ci-st5'
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

  const moderatorStaffId = moderatorStaffIdForDataset(dataset)
  const assignment = assignments.find(candidate => candidate.teacherId !== moderatorStaffId) ?? assignments[0]
  if (!assignment) {
    return { campaigns: 0 }
  }

  const campaignId = `ff-campaign-${dataset.schoolId}`
  await port.createCampaign({
    requestId: `dev-family-feedback-seed:${dataset.schoolId}`,
    id: campaignId,
    academicYearId,
    academicPeriodId: period.id,
    teacherAssignmentId: assignment.id,
  })

  const staffIds = new Set((await port.listStaffMembers()).map(staff => staff.id))
  if (moderatorStaffId && staffIds.has(moderatorStaffId)) {
    await port.assignModerator({
      requestId: `dev-family-feedback-moderator:${dataset.schoolId}`,
      id: campaignId,
      moderatorStaffId,
    })
  }

  return { campaigns: 1 }
}
