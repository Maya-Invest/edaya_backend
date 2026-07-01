import type { ActivityEnrollmentInput, ActivityInput } from '@edaya/core'
import { ActivityCategory, ActivityEnrollmentStatus } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import { demoActivities, demoActivityEnrollments } from '../../../../src/datasets/demo/domains/activities'

describe('demo activities', () => {
  it('typed activities satisfy ActivityInput', () => {
    const activity = demoActivities[0] satisfies ActivityInput
    expect(activity.category).toBe(ActivityCategory.Science)
    expect(activity.startDate).toBe('2025-09-15T12:00:00.000Z')
  })

  it('typed enrollments satisfy ActivityEnrollmentInput', () => {
    const enrollment = demoActivityEnrollments[0] satisfies ActivityEnrollmentInput
    expect(enrollment.status).toBe(ActivityEnrollmentStatus.Approved)
    expect(enrollment.id).toBe('ae-act-robot-s1')
  })

  it('includes more enrollments than activities', () => {
    expect(demoActivityEnrollments.length).toBeGreaterThan(demoActivities.length)
  })
})
