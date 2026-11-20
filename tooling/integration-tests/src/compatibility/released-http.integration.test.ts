import { expect, it } from 'bun:test'
import { describeWithLightSchool } from '../support/seeded-route-test-context'

// Deliberately handwritten wire requests. Client generation must never update
// these expectations; changes need a compatibility decision for released apps.
describeWithLightSchool('released HTTP behavior', (getContext) => {
  it('keeps unauthenticated school access unauthorized', async () => {
    const { app } = getContext()
    const response = await app.request('/core/authorization/effective-grants')
    expect(response.status).toBe(401)
  })

  it('retains list, count, and missing-entity response semantics', async () => {
    const { app, authHeaders } = getContext()
    const headers = await authHeaders()
    const response = await app.request('/core/entities/schools/list', {
      method: 'POST',
      headers,
      body: JSON.stringify({ $limit: 1, $offset: 0 }),
    })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    const schools = await response.json() as { id: string, name: string }[]
    expect(Array.isArray(schools)).toBe(true)
    expect(schools).toHaveLength(1)
    expect(schools[0]).toMatchObject({ id: expect.any(String), name: expect.any(String) })
    const count = await app.request('/core/entities/schools/count', { method: 'POST', headers, body: '{}' })
    expect(count.status).toBe(200)
    expect(await count.json()).toMatchObject({ count: expect.any(Number) })
    expect((await app.request('/core/entities/schools/nonexistent-compatibility-school', { headers })).status).toBe(404)
  })

  it('retains explicit actor and assurance fields used by released staff clients', async () => {
    const { app, authHeaders } = getContext()
    const response = await app.request('/core/authorization/effective-grants', { headers: await authHeaders() })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ kind: 'staff', actorId: expect.any(String), schoolId: expect.any(String), assuranceLevel: 'verified', grants: expect.any(Array) })
  })
})
