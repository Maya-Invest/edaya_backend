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
  it('defines recurring teaching slots for ci-t1 across collège classes', () => {
    expect(demoCiResources).toHaveLength(3)
    expect(demoCiClassResourceAssignments).toHaveLength(2)
    expect(demoCiSchedulingSlots).toHaveLength(6)
    expect(demoCiSchedules).toHaveLength(6)

    const teacherIds = new Set(demoCiSchedulingSlots.map(slot => slot.teacherId))
    expect(teacherIds).toEqual(new Set(['ci-t1', 'ci-t3']))

    const classGroupIds = new Set(demoCiSchedulingSlots.map(slot => slot.schedule.classGroupId))
    expect(classGroupIds).toEqual(new Set(['ci-6a', 'ci-5a', 'ci-6b']))
  })

  it('typed schedules satisfy ScheduleInput', () => {
    const schedule = demoCiSchedules[0] satisfies ScheduleInput
    expect(schedule.dayOfWeek).toBe(DayOfWeek.Monday)
    expect(schedule.classSubjectId).toBe('ci-cs-6a-math')
  })
})
