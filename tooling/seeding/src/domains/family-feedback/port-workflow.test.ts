import type { FamilyFeedbackSeedPort } from './port'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevFamilyFeedback } from './workflow'

describe('family feedback seed workflow', () => {
  test('creates one draft campaign and assigns a moderator after access grants', async () => {
    const created: string[] = []
    const assigned: string[] = []
    const port: FamilyFeedbackSeedPort = {
      listSubjectAssignments: async () => [{ id: 'ta-subject-1', teacherId: 't1' }],
      listStaffMembers: async () => [{ id: 'ci-st5' }, { id: 'ci-st4' }],
      listCampaigns: async () => created.map(id => ({ id, status: 'draft' })),
      createCampaign: async (record) => {
        expect(record.teacherAssignmentId).toBe('ta-subject-1')
        expect(record.moderatorStaffId).toBeUndefined()
        expect(record.academicYearId).toBe(demoCiDataset.entities.academicYear?.id)
        expect(record.academicPeriodId).toBe(demoCiDataset.entities.academicPeriods?.[0]?.id)
        created.push(record.id)
      },
      assignModerator: async (record) => {
        expect(record.id).toBe(`ff-campaign-${demoCiDataset.schoolId}`)
        expect(record.moderatorStaffId).toBe('ci-st5')
        assigned.push(record.moderatorStaffId)
      },
    }

    expect(await seedDevFamilyFeedback(port, demoCiDataset)).toEqual({ campaigns: 1 })
    expect(await seedDevFamilyFeedback(port, demoCiDataset)).toEqual({ campaigns: 0 })
    expect(created).toHaveLength(1)
    expect(assigned).toEqual(['ci-st5'])
  })

  test('skips when no subject assignments exist', async () => {
    const port: FamilyFeedbackSeedPort = {
      listSubjectAssignments: async () => [],
      listStaffMembers: async () => [{ id: 'ci-st5' }],
      listCampaigns: async () => [],
      createCampaign: async () => {
        throw new Error('must not create a campaign without a subject assignment')
      },
      assignModerator: async () => {
        throw new Error('must not assign a moderator without a campaign')
      },
    }

    expect(await seedDevFamilyFeedback(port, demoCiDataset)).toEqual({ campaigns: 0 })
  })
})
