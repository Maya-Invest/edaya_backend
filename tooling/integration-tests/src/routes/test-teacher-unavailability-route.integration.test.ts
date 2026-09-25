import { DayOfWeek, Teacher, TeacherUnavailabilityRecurrence } from '@edaya/core'
import { MINIMAL_AUTH_FIXTURE_STAFF_EMAIL } from '@edaya/fixtures/meta/dev-auth-fixtures'
import { DEMO_CI_ACADEMIC_YEAR_ID } from '@edaya/fixtures/shared/ids'
import { expect, it } from 'bun:test'
import { createInProcessSchoolClient } from '../support/in-process-school-client'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

describeWithLightSchool('teacher unavailability routes', (getContext) => {
  it('saves, lists, gets, and deletes a weekly rule through the generated client', async () => {
    const { application, app, authHeaders } = getContext()
    const school = (await application.repositories.schools.list({ $limit: 1 }))[0]!
    await application.repositories.teachers.save(new Teacher({ id: 't1', schoolId: school.id, firstName: 'Route', lastName: 'Teacher' }))
    const authorization = (await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)).authorization
    const client = createInProcessSchoolClient(app, { headers: { authorization } })
    const input = {
      id: 'route-teacher-unavailability',
      teacherId: 't1',
      academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Tuesday,
      startTime: '08:30',
      endTime: '11:00',
      effectiveFrom: '2026-09-14T00:00:00.000Z',
      effectiveUntil: '2026-12-31T00:00:00.000Z',
      reason: 'Contract teaching hours',
      isActive: true,
    }

    const saved = await client.entities.teacherUnavailabilities.save(input)
    expect(saved).toMatchObject({
      id: input.id,
      teacherId: 't1',
      recurrence: TeacherUnavailabilityRecurrence.Weekly,
      dayOfWeek: DayOfWeek.Tuesday,
    })
    await expect(client.entities.teacherUnavailabilities.list({ teacherId: 't1' }))
      .resolves
      .toContainEqual(expect.objectContaining({ id: input.id }))
    await expect(client.entities.teacherUnavailabilities.get(input.id))
      .resolves
      .toMatchObject({ reason: 'Contract teaching hours' })

    await client.entities.teacherUnavailabilities.delete({ id: input.id })
    await expect(client.entities.teacherUnavailabilities.get(input.id)).rejects.toMatchObject({ status: 404 })
  })
}, { isolate: true })
