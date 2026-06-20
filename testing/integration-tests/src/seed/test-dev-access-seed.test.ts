import {
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  MINIMAL_AUTH_FIXTURE_STAFF_ID,
  SEED_STAFF,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev access seed', (getContext) => {
  it('lets seeded teachers list students after access roles are provisioned', async () => {
    const { app, authHeaders } = getContext()
    const response = await app.request(createAppRequest('/core/entities/students/list', {
      method: 'POST',
      headers: await authHeaders(DEV_AUTH_STAFF_ACCOUNTS[1].email),
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
  })

  it('lets seeded teachers list guardians and class subjects for migrated webapp slices', async () => {
    const { app, authHeaders } = getContext()
    const headers = await authHeaders(DEV_AUTH_STAFF_ACCOUNTS[1].email)

    const guardians = await app.request(createAppRequest('/core/entities/guardians/list', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }))
    const classSubjects = await app.request(createAppRequest('/core/entities/class-subjects/list', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }))

    expect(guardians.status).toBe(200)
    expect(classSubjects.status).toBe(200)

    const guardianBody = await guardians.json() as unknown[]
    const classSubjectBody = await classSubjects.json() as unknown[]
    expect(guardianBody.length).toBeGreaterThanOrEqual(6)
    expect(classSubjectBody.length).toBeGreaterThanOrEqual(8)
  })

  it('seeds all staff members and lets the director list them', async () => {
    const { app, application, authHeaders } = getContext()

    const staffMembers = await application.repositories.staffMembers.list({})
    const directorAssignments = await application.repositories.staffRoleAssignments.list({
      staffId: MINIMAL_AUTH_FIXTURE_STAFF_ID,
      status: 'active',
    })
    expect(staffMembers.length).toBe(SEED_STAFF.length)
    expect(directorAssignments.some(entry => entry.roleIds.includes('role-director'))).toBe(true)

    const staffCount = await app.request(createAppRequest('/core/entities/staff-members/count', {
      method: 'POST',
      headers: await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL),
      body: JSON.stringify({}),
    }))

    expect(staffCount.status).toBe(200)
    const countBody = await staffCount.json() as { count: number }
    expect(countBody.count).toBe(SEED_STAFF.length)
  })

  it('seeds access roles and lets the director list them', async () => {
    const { app, application, authHeaders } = getContext()

    const accessRoles = await application.repositories.accessRoles.list({})
    expect(accessRoles.length).toBe(4)
    expect(accessRoles.some(role => role.id === 'role-director')).toBe(true)
    expect(accessRoles.some(role => role.id === 'role-teacher')).toBe(true)

    const response = await app.request(createAppRequest('/core/entities/access-roles/list', {
      method: 'POST',
      headers: await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL),
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
    const body = await response.json() as unknown[]
    expect(body.length).toBeGreaterThanOrEqual(4)
  })
})
