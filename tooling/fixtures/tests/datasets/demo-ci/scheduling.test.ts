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
  it('defines a full school week for 6ème 1 plus collège sample slots', () => {
    expect(demoCiResources).toHaveLength(3)
    expect(demoCiClassResourceAssignments).toHaveLength(2)
    expect(demoCiSchedulingSlots).toHaveLength(14)
    expect(demoCiSchedules).toHaveLength(14)

    const teacherIds = new Set(demoCiSchedulingSlots.map(slot => slot.teacherId))
    expect(teacherIds).toEqual(new Set(['ci-t1', 'ci-t2', 'ci-t3', 'ci-t4', 'ci-t5']))

    const classGroupIds = new Set(demoCiSchedulingSlots.map(slot => slot.schedule.classGroupId))
    expect(classGroupIds).toEqual(new Set(['ci-6a', 'ci-5a', 'ci-6b']))

    const sixA = demoCiSchedulingSlots.filter(slot => slot.schedule.classGroupId === 'ci-6a')
    expect(sixA).toHaveLength(11)
    expect(new Set(sixA.map(slot => slot.schedule.dayOfWeek))).toEqual(new Set([
      DayOfWeek.Monday,
      DayOfWeek.Tuesday,
      DayOfWeek.Wednesday,
      DayOfWeek.Thursday,
      DayOfWeek.Friday,
    ]))
  })

  it('typed schedules satisfy ScheduleInput', () => {
    const schedule = demoCiSchedules[0] satisfies ScheduleInput
    expect(schedule.dayOfWeek).toBe(DayOfWeek.Monday)
    expect(schedule.classSubjectId).toBe('ci-cs-6a-math')
  })
})
