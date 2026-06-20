import {
  DEV_AUTH_STAFF_ACCOUNTS,
  SEED_TEACHING_LOG_ENTRIES,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev teaching log seed', (getContext) => {
  it('seeds class logbook entries and exposes them via entity routes', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.classLogbookEntries).toBe(SEED_TEACHING_LOG_ENTRIES.length)

    const headers = await authHeaders(DEV_AUTH_STAFF_ACCOUNTS[1].email)
    const entriesResponse = await app.request(createAppRequest('/core/entities/class-logbook-entries/list', {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
    }))

    expect(entriesResponse.status).toBe(200)

    const entries = unwrapEntityList<{
      id: string
      classGroupId: string
      classSubjectId: string
      chapter: string
      homework?: string
      progress: number
    }>(await entriesResponse.json())

    const class6aEntries = entries.filter(entry => entry.classGroupId === '6a')

    expect(entries.length).toBe(SEED_TEACHING_LOG_ENTRIES.length)
    expect(class6aEntries.length).toBe(SEED_TEACHING_LOG_ENTRIES.filter(entry => entry.classGroupId === '6a').length)
    expect(entries.some(entry => entry.id === 'tle-cs-6a-math-0' && entry.classSubjectId === 'cs-6a-math')).toBe(true)
    expect(entries.some(entry => entry.id === 'tle-cs-6a-math-0' && entry.homework === 'Manuel p.84 ex. 12 à 18')).toBe(true)
    expect(entries.some(entry => entry.id === 'tle-cs-term-advmath-0')).toBe(true)
  })
})
