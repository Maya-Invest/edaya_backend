import {
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_DEADLINES,
  SEED_HOMEWORK_ASSIGNMENTS,
  SEED_HOMEWORK_SUBMISSIONS,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev homework seed', (getContext) => {
  it('seeds homework assignments and submissions and exposes them via entity routes', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.homeworkAssignments).toBe(SEED_HOMEWORK_ASSIGNMENTS.length)
    expect(seedResult.homeworkSubmissions).toBe(SEED_HOMEWORK_SUBMISSIONS.length)

    const headers = await authHeaders(DEV_AUTH_STAFF_ACCOUNTS[1].email)
    const [assignmentsResponse, submissionsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/homework-assignments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/homework-submissions/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(assignmentsResponse.status).toBe(200)
    expect(submissionsResponse.status).toBe(200)

    const assignments = unwrapEntityList<{ id: string, classGroupId: string }>(await assignmentsResponse.json())
    const filteredAssignments = assignments.filter(assignment => assignment.classGroupId === '6a')
    const submissions = unwrapEntityList<{ homeworkAssignmentId: string, status: string }>(await submissionsResponse.json())
      .filter(submission => submission.homeworkAssignmentId === 'd1')

    expect(assignments.length).toBe(SEED_DEADLINES.length)
    expect(filteredAssignments.length).toBe(SEED_DEADLINES.filter(deadline => deadline.classGroupId === '6a').length)
    expect(filteredAssignments.every(assignment => assignment.classGroupId === '6a')).toBe(true)
    expect(assignments.some(assignment => assignment.id === 'd1')).toBe(true)
    expect(submissions.some(submission => submission.homeworkAssignmentId === 'd1' && submission.status === 'submitted')).toBe(true)
    expect(submissions.some(submission => submission.homeworkAssignmentId === 'd1' && submission.status === 'missing')).toBe(true)
  })
})
