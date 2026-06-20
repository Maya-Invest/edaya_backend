import {
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_ACTIVITY_ENROLLMENTS,
  SEED_EXTRACURRICULAR_ACTIVITIES,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev activities seed', (getContext) => {
  it('seeds extracurricular activities and enrollments and exposes them via entity routes', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.activities).toBe(SEED_EXTRACURRICULAR_ACTIVITIES.length)
    expect(seedResult.activityEnrollments).toBe(SEED_ACTIVITY_ENROLLMENTS.length)

    const headers = await authHeaders(DEV_AUTH_STAFF_ACCOUNTS[1].email)
    const [activitiesResponse, enrollmentsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/activities/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/activity-enrollments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(activitiesResponse.status).toBe(200)
    expect(enrollmentsResponse.status).toBe(200)

    const activities = unwrapEntityList<{ id: string, name: string, capacity: number, participants: number }>(
      await activitiesResponse.json(),
    )
    const enrollments = unwrapEntityList<{ activityId: string, studentId: string, status: string }>(
      await enrollmentsResponse.json(),
    )

    expect(activities.length).toBe(SEED_EXTRACURRICULAR_ACTIVITIES.length)
    expect(activities.find(activity => activity.id === 'act-robot')).toMatchObject({
      name: 'Club Robotique',
      capacity: 24,
      participants: 18,
    })
    expect(enrollments.some(enrollment => (
      enrollment.activityId === 'act-robot'
      && enrollment.studentId === 's1'
      && enrollment.status === 'approved'
    ))).toBe(true)
    expect(enrollments.some(enrollment => (
      enrollment.activityId === 'act-robot'
      && enrollment.studentId === 's3'
      && enrollment.status === 'denied'
    ))).toBe(true)
  })
})
