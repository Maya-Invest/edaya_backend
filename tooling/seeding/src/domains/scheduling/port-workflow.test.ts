import type {
  LessonSessionProgressSeedRecord,
  LessonSessionStaffAssignmentSeedRecord,
  ScheduleSeedRecord,
  SchedulingSeedPort,
} from './port'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevScheduling } from './workflow'

describe('scheduling seed port workflow', () => {
  test('seeds demo-ci schedules and materializes lesson sessions', async () => {
    const slots = demoCiDataset.extensions?.schedulingSlots ?? []
    const schedules: ScheduleSeedRecord[] = []
    const materializedScheduleIds: string[] = []
    const staffAssignments: LessonSessionStaffAssignmentSeedRecord[] = []
    const progress: LessonSessionProgressSeedRecord[] = []
    const port: SchedulingSeedPort = {
      saveResource: async () => {},
      assignResourceToClass: async () => {},
      createSchedule: async (record) => {
        schedules.push(record)
      },
      materializeSchedule: async ({ scheduleId }) => {
        materializedScheduleIds.push(scheduleId)
      },
      assignStaffToLessonSession: async (record) => {
        staffAssignments.push(record)
      },
      assignResourceToLessonSession: async () => {},
      recordLessonSessionProgress: async (record) => {
        progress.push(record)
      },
    }

    await seedDevScheduling(port, demoCiDataset)

    expect(slots).toHaveLength(6)
    expect(schedules).toHaveLength(6)
    expect(materializedScheduleIds).toHaveLength(slots.length)
    expect(staffAssignments).toHaveLength(0)
    expect(progress).toHaveLength(
      demoCiDataset.extensions?.schedulingSessionProgressAnchors?.length ?? 0,
    )
  })
})
