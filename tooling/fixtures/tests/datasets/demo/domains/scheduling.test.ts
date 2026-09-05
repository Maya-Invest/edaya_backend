import type { ResourceAssignmentInput, ResourceInput, ScheduleInput } from '@edaya/core'
import { DayOfWeek } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoClassResourceAssignments,
  demoResources,
  demoSchedules,
  demoSchedulingSessionProgressAnchor,
  demoSchedulingSlots,
} from '../../../../src/datasets/demo/domains/scheduling'
import { planningSessionDateForDayOfWeek } from '../../../../src/meta/dates'

describe('demo scheduling', () => {
  it('exposes typed resources, schedules, and slots', () => {
    expect(demoResources).toHaveLength(7)
    expect(demoClassResourceAssignments).toHaveLength(3)
    expect(demoSchedules).toHaveLength(16)
    expect(demoSchedulingSlots).toHaveLength(16)
  })

  it('typed class resource assignments satisfy ResourceAssignmentInput', () => {
    const assignment = demoClassResourceAssignments[0] satisfies ResourceAssignmentInput
    expect(assignment.classGroupId).toBe('6a')
  })

  it('typed resources satisfy ResourceInput', () => {
    const resource = demoResources[0] satisfies ResourceInput
    expect(resource.name).toBe('Auditorium')
  })

  it('typed schedules satisfy ScheduleInput', () => {
    const schedule = demoSchedules[0] satisfies ScheduleInput
    expect(schedule.dayOfWeek).toBe(DayOfWeek.Monday)
  })

  it('planning session dates align with the reference week', () => {
    expect(planningSessionDateForDayOfWeek(DayOfWeek.Monday)).toBe('2026-05-11')
    expect(planningSessionDateForDayOfWeek(DayOfWeek.Friday)).toBe('2026-05-15')
  })

  it('session progress anchor references the first planning slot', () => {
    expect(demoSchedulingSessionProgressAnchor.progress.id).toBe('csp-p1')
  })
})
