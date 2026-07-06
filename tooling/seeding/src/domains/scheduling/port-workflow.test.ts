import type {
  ClassResourceAssignmentSeedRecord,
  LessonSessionProgressSeedRecord,
  LessonSessionResourceAssignmentSeedRecord,
  LessonSessionStaffAssignmentSeedRecord,
  ResourceSeedRecord,
  ScheduleSeedRecord,
  SchedulingSeedPort,
} from './port'
import { demoCiDataset, demoDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevScheduling } from './workflow'

describe('scheduling seed port workflow', () => {
  test('seeds resources, class assignments, schedules, lesson sessions, assignments, and progress records', async () => {
    const slots = demoDataset.extensions?.schedulingSlots ?? []
    const classResourceAssignments = demoDataset.extensions?.classResourceAssignments ?? []
    const resources: ResourceSeedRecord[] = []
    const classAssignments: ClassResourceAssignmentSeedRecord[] = []
    const schedules: ScheduleSeedRecord[] = []
    const materializedScheduleIds: string[] = []
    const staffAssignments: LessonSessionStaffAssignmentSeedRecord[] = []
    const resourceAssignments: LessonSessionResourceAssignmentSeedRecord[] = []
    const progress: LessonSessionProgressSeedRecord[] = []
    const port: SchedulingSeedPort = {
      saveResource: async (record) => {
        resources.push(record)
      },
      assignResourceToClass: async (record) => {
        classAssignments.push(record)
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

    await seedDevScheduling(port, demoDataset)

    expect(resources).toHaveLength(demoDataset.entities.resources?.length ?? 0)
    expect(classAssignments).toHaveLength(classResourceAssignments.length)
    expect(schedules).toHaveLength(slots.length)
    expect(materializedScheduleIds).toHaveLength(slots.length)
    expect(staffAssignments).toHaveLength(slots.length)
    expect(resourceAssignments).toHaveLength(
      slots.filter(slot => slot.resourceId).length,
    )
    expect(progress).toHaveLength(
      (demoDataset.extensions?.schedulingSessionProgressAnchor ? 1 : 0)
      + (demoDataset.extensions?.schedulingSessionProgressAnchors?.length ?? 0),
    )
  })

  test('seeds demo-ci math slots for ci-t1 without lesson-session staff assignments', async () => {
    const slots = demoCiDataset.extensions?.schedulingSlots ?? []
    const schedules: ScheduleSeedRecord[] = []
    const staffAssignments: LessonSessionStaffAssignmentSeedRecord[] = []
    const progress: LessonSessionProgressSeedRecord[] = []
    const port: SchedulingSeedPort = {
      saveResource: async () => {},
      assignResourceToClass: async () => {},
      createSchedule: async (record) => {
        schedules.push(record)
      },
      materializeSchedule: async () => {},
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
    expect(staffAssignments).toHaveLength(0)
    expect(slots.every(slot => slot.teacherId === 'ci-t1')).toBe(true)
    expect(progress).toHaveLength(
      demoCiDataset.extensions?.schedulingSessionProgressAnchors?.length ?? 0,
    )
  })
})
