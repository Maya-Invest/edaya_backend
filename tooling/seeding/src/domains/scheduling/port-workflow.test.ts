import type {
  LessonSessionProgressSeedRecord,
  LessonSessionResourceAssignmentSeedRecord,
  LessonSessionStaffAssignmentSeedRecord,
  ResourceSeedRecord,
  ScheduleSeedRecord,
  SchedulingSeedPort,
} from './port'
import { SEED_PLANNING_SLOTS, SEED_RESOURCES } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevScheduling } from './workflow'

describe('scheduling seed port workflow', () => {
  test('seeds resources, schedules, lesson sessions, assignments, and progress records', async () => {
    const resources: ResourceSeedRecord[] = []
    const schedules: ScheduleSeedRecord[] = []
    const materializedScheduleIds: string[] = []
    const staffAssignments: LessonSessionStaffAssignmentSeedRecord[] = []
    const resourceAssignments: LessonSessionResourceAssignmentSeedRecord[] = []
    const progress: LessonSessionProgressSeedRecord[] = []
    const port: SchedulingSeedPort = {
      saveResource: async (record) => {
        resources.push(record)
      },
      createSchedule: async (record) => {
        schedules.push(record)
      },
      materializeSchedule: async ({ scheduleId }) => {
        materializedScheduleIds.push(scheduleId)
      },
      assignStaffToLessonSession: async (record) => {
        staffAssignments.push(record)
      },
      assignResourceToLessonSession: async (record) => {
        resourceAssignments.push(record)
      },
      recordLessonSessionProgress: async (record) => {
        progress.push(record)
      },
    }

    await seedDevScheduling(port)

    expect(resources).toHaveLength(SEED_RESOURCES.length)
    expect(schedules).toHaveLength(SEED_PLANNING_SLOTS.length)
    expect(materializedScheduleIds).toHaveLength(SEED_PLANNING_SLOTS.length)
    expect(staffAssignments).toHaveLength(SEED_PLANNING_SLOTS.length)
    expect(resourceAssignments).toHaveLength(
      SEED_PLANNING_SLOTS.filter(slot => 'resourceId' in slot && slot.resourceId).length,
    )
    expect(progress).toHaveLength(1)
    expect(progress[0]?.lessonSessionId).toMatch(/^sch-p1:\d{4}-\d{2}-\d{2}$/)
  })
})
