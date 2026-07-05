import type { ScheduleInput } from '@edaya/core'
import { DayOfWeek } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoCiClassResourceAssignments,
  demoCiResources,
  demoCiSchedules,
  demoCiSchedulingSlots,
} from '../../../src/datasets/demo-ci/domains/scheduling'

describe('demo-ci scheduling', () => {
  it('defines recurring math slots for ci-st1 in 6ème A and 5ème A', () => {
    expect(demoCiResources).toHaveLength(3)
    expect(demoCiClassResourceAssignments).toHaveLength(2)
    expect(demoCiSchedulingSlots).toHaveLength(4)
    expect(demoCiSchedules).toHaveLength(4)

    const teacherIds = new Set(demoCiSchedulingSlots.map(slot => slot.teacherId))
    expect(teacherIds).toEqual(new Set(['ci-st1']))

    const classGroupIds = new Set(demoCiSchedulingSlots.map(slot => slot.schedule.classGroupId))
    expect(classGroupIds).toEqual(new Set(['ci-6a', 'ci-5a']))
  })

  it('typed schedules satisfy ScheduleInput', () => {
    const schedule = demoCiSchedules[0] satisfies ScheduleInput
    expect(schedule.dayOfWeek).toBe(DayOfWeek.Monday)
    expect(schedule.classSubjectId).toBe('ci-cs-6a-math')
  })
})
