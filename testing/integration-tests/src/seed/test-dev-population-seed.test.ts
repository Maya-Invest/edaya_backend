import {
  countSeedGuardians,
  countSeedStudents,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_CLASS_STUDENT_IDS,
  SEED_TARGET_STUDENT_COUNT,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev population seed', (getContext) => {
  it('seeds 30 students and 21 guardians with class distribution and staff assignments', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.students).toBe(SEED_TARGET_STUDENT_COUNT)
    expect(seedResult.students).toBe(countSeedStudents())
    expect(seedResult.guardians).toBe(countSeedGuardians())

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [studentsResponse, guardiansResponse, enrollmentsResponse, staffAssignmentsResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/students/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/guardians/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/enrollments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/staff-assignments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(studentsResponse.status).toBe(200)
    expect(guardiansResponse.status).toBe(200)
    expect(enrollmentsResponse.status).toBe(200)
    expect(staffAssignmentsResponse.status).toBe(200)

    const students = unwrapEntityList<{ id: string }>(await studentsResponse.json())
    const guardians = unwrapEntityList<{ id: string }>(await guardiansResponse.json())
    const enrollments = unwrapEntityList<{ studentId: string, classGroupId: string }>(await enrollmentsResponse.json())
    const staffAssignments = unwrapEntityList<{ id: string, classGroupId?: string, responsibility?: string }>(
      await staffAssignmentsResponse.json(),
    )

    expect(students.length).toBe(SEED_TARGET_STUDENT_COUNT)
    expect(guardians.length).toBeGreaterThanOrEqual(countSeedGuardians())
    expect(enrollments.length).toBe(SEED_TARGET_STUDENT_COUNT)
    expect(students.some(student => student.id === 's30')).toBe(true)
    expect(guardians.some(guardian => guardian.id === 'g9')).toBe(true)

    for (const [classGroupId, studentIds] of Object.entries(SEED_CLASS_STUDENT_IDS)) {
      for (const studentId of studentIds) {
        expect(enrollments.some(enrollment => enrollment.studentId === studentId && enrollment.classGroupId === classGroupId)).toBe(true)
      }
    }

    expect(staffAssignments.some(assignment => assignment.id === 'sa-st2-6b' && assignment.classGroupId === '6b')).toBe(true)
    expect(staffAssignments.some(assignment => assignment.id === 'sa-st3-5a' && assignment.classGroupId === '5a')).toBe(true)
  })
})
