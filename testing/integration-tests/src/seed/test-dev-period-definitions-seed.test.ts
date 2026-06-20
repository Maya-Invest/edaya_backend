import {
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_PERIOD_DEFINITIONS,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev period definitions seed', (getContext) => {
  it('seeds daily time slots and lets teachers list them via period-definitions/list', async () => {
    const { app, application, seedResult, authHeaders } = getContext()
    expect(seedResult.periodDefinitions).toBe(SEED_PERIOD_DEFINITIONS.length)

    const stored = await application.repositories.periodDefinitions.list({})
    expect(stored.length).toBe(SEED_PERIOD_DEFINITIONS.length)
    expect(stored.some(slot => slot.label === 'Période 1' && slot.startTime === '08:00')).toBe(true)
    expect(stored.filter(slot => slot.isBreak).length).toBe(3)

    const headers = await authHeaders(DEV_AUTH_STAFF_ACCOUNTS[1].email)
    const response = await app.request(createAppRequest('/core/entities/period-definitions/list', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
    const body = unwrapEntityList<{ label: string, startTime: string, endTime: string, isBreak: boolean }>(
      await response.json(),
    )
    expect(body.length).toBeGreaterThanOrEqual(SEED_PERIOD_DEFINITIONS.length)
    expect(body.some(slot => slot.startTime === '08:00' && slot.endTime === '08:45')).toBe(true)
  })
})
