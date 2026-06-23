import type {
  ResourceSeedRecord,
  ScheduleSeedRecord,
  SchedulingSeedPort,
  SessionProgressSeedRecord,
  SessionResourceAssignmentSeedRecord,
  SessionSeedRecord,
  SessionStaffAssignmentSeedRecord,
} from './port'
import { SEED_PLANNING_SLOTS, SEED_RESOURCES } from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevScheduling } from './workflow'

describe('scheduling seed port workflow', () => {
  test('seeds resources, schedules, sessions, assignments, and progress records', async () => {
    const resources: ResourceSeedRecord[] = []
    const schedules: ScheduleSeedRecord[] = []
    const sessions: SessionSeedRecord[] = []
    const staffAssignments: SessionStaffAssignmentSeedRecord[] = []
    const resourceAssignments: SessionResourceAssignmentSeedRecord[] = []
    const progress: SessionProgressSeedRecord[] = []
    const port: SchedulingSeedPort = {
      saveResource: async (record) => {
        resources.push(record)
      },
      createSchedule: async (record) => {
        schedules.push(record)
      },
      createSession: async (record) => {
        sessions.push(record)
      },
      assignStaffToSession: async (record) => {
        staffAssignments.push(record)
      },
      assignResourceToSession: async (record) => {
        resourceAssignments.push(record)
      },
      recordSessionProgress: async (record) => {
        progress.push(record)
      },
    }

    await seedDevScheduling(port)

    expect(resources).toHaveLength(SEED_RESOURCES.length)
    expect(schedules).toHaveLength(SEED_PLANNING_SLOTS.length)
    expect(sessions).toHaveLength(SEED_PLANNING_SLOTS.length)
    expect(sessions[0]?.startsAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/)
    expect(staffAssignments).toHaveLength(SEED_PLANNING_SLOTS.length)
    expect(resourceAssignments).toHaveLength(
      SEED_PLANNING_SLOTS.filter(slot => 'resourceId' in slot && slot.resourceId).length,
    )
    expect(progress).toHaveLength(1)
  })
})
