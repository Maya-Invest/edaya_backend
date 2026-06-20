import {
  countSeedPlanningSlots,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
  SEED_PLANNING_SLOTS,
  SEED_RESOURCES,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev scheduling seed', (getContext) => {
  it('seeds resources, schedules, sessions and lets teachers list sessions', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.resources).toBe(SEED_RESOURCES.length)
    expect(seedResult.schedules).toBe(countSeedPlanningSlots())
    expect(seedResult.sessions).toBe(countSeedPlanningSlots())

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [sessionsResponse, resourcesResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/sessions/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/resources/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(sessionsResponse.status).toBe(200)
    expect(resourcesResponse.status).toBe(200)

    const sessions = unwrapEntityList<{ id: string, classGroupId: string, title: string }>(await sessionsResponse.json())
    const resources = unwrapEntityList<{ id: string, name: string }>(await resourcesResponse.json())

    expect(sessions.length).toBeGreaterThanOrEqual(SEED_PLANNING_SLOTS.length)
    expect(resources.length).toBeGreaterThanOrEqual(SEED_RESOURCES.length)
    expect(sessions.some(session => session.id === 'sess-p1' && session.classGroupId === '6a')).toBe(true)
    expect(resources.some(resource => resource.name === 'Gymnasium')).toBe(true)
  })
})
