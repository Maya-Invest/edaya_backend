import type { FamilyFeedbackSeedPort } from './port'
import { demoDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevFamilyFeedback } from './workflow'

describe('family feedback seed workflow', () => {
  test('creates one draft campaign from the first subject assignment and skips when campaigns exist', async () => {
    const created: string[] = []
    const port: FamilyFeedbackSeedPort = {
      listSubjectAssignments: async () => [{ id: 'ta-subject-1', teacherId: 't1' }],
      listStaffMembers: async () => [{ id: 'st5' }, { id: 'st1' }],
      listCampaigns: async () => created.map(id => ({ id, status: 'draft' })),
      createCampaign: async (record) => {
        expect(record.teacherAssignmentId).toBe('ta-subject-1')
        expect(record.moderatorStaffId).toBe('st5')
        expect(record.academicYearId).toBe(demoDataset.entities.academicYear?.id)
        expect(record.academicPeriodId).toBe(demoDataset.entities.academicPeriods?.[0]?.id)
        created.push(record.id)
      },
    }

    expect(await seedDevFamilyFeedback(port, demoDataset)).toEqual({ campaigns: 1 })
    expect(await seedDevFamilyFeedback(port, demoDataset)).toEqual({ campaigns: 0 })
    expect(created).toHaveLength(1)
  })

  test('skips when no subject assignments exist', async () => {
    const port: FamilyFeedbackSeedPort = {
      listSubjectAssignments: async () => [],
      listStaffMembers: async () => [{ id: 'st5' }],
      listCampaigns: async () => [],
      createCampaign: async () => {
        throw new Error('must not create a campaign without a subject assignment')
      },
    }

    expect(await seedDevFamilyFeedback(port, demoDataset)).toEqual({ campaigns: 0 })
  })
})
