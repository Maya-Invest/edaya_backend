import { readFile } from 'node:fs/promises'
import { AttachmentOwnerKind } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import { buildSeedProfileAttachmentId, profilePictureForOwner, resolveProfilePicturePath } from '@edaya/fixtures/shared/profile-pictures'
import { createHttpProfilePicturesSeedPort, HttpSeedClient, runHttpDevSeeds } from '@edaya/seeding/http'
import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { createCoreRouteTestApp } from '../../support/api-route-harness'
import { bootstrapHttpSeedForDiagnostics } from '../../support/http-seed-bootstrap'
import { createHttpClientForApp } from '../../support/http-seed-client'

describe('dev seed validation harness — HTTP validate scope', () => {
  let context: Awaited<ReturnType<typeof createCoreRouteTestApp>>
  let serviceAccountApiKey: string
  beforeAll(async () => {
    context = await createCoreRouteTestApp({ withEmbeddedLocalFiles: true, autoCleanup: false, identity: 'live' })
    serviceAccountApiKey = await bootstrapHttpSeedForDiagnostics(createHttpClientForApp(context.app), { withProfilePhotos: true })
  }, 600_000)
  afterAll(async () => {
    try {
      await context?.runtime.close()
    }
    finally {
      context?.localFiles?.stop()
    }
  })

  it('runs HTTP validate scope after scoped bootstrap', async () => {
    const client = createHttpClientForApp(context.app)
    const headers = { authorization: `Bearer ${serviceAccountApiKey}` }
    // Exhaustive photo population belongs to seed/contract; this exercises real HTTP storage.
    for (const teacher of (demoCiDataset.entities.teachers ?? []).slice(0, 1)) {
      const attachmentId = buildSeedProfileAttachmentId('teacher', teacher.id)
      const saved = await client.jsonRequest<{ photoUrl?: string }>(`/core/entities/teachers/${teacher.id}`, { headers })
      expect(saved.response.status).toBe(200)
      expect(saved.body).toMatchObject({ firstName: teacher.firstName, lastName: teacher.lastName, email: teacher.email })
      expect(saved.body?.photoUrl).toBe(`${client.origin}/core/files/${attachmentId}/content`)
      const grant = await client.jsonRequest<{ downloadUrl: string }>(`/core/files/${attachmentId}/download-url`, { headers })
      expect(grant.response.status).toBe(200)
      const image = await client.request(grant.body!.downloadUrl)
      expect(image.status).toBe(200)
      expect(image.headers.get('content-type')).toBe('image/jpeg')
      expect(new Uint8Array(await image.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0xFF, 0xD8]))
    }

    const validation = await runHttpDevSeeds({
      client,
      scope: 'validate',
    })

    expect(validation.validation?.status).toBe('passed')
    expect(validation.validation?.failures ?? []).toEqual([])
    expect(validation.validation?.entities.every(entry => entry.status === 'passed')).toBe(true)
    expect(validation.validation?.queries.every(entry => entry.status === 'passed')).toBe(true)
  }, 600_000)

  it('returns structured doctor findings from the same healthy HTTP bootstrap', async () => {
    const doctor = await runHttpDevSeeds({ client: createHttpClientForApp(context.app), scope: 'doctor', serviceAccountApiKey })
    expect(doctor.doctor?.status).not.toBe('broken')
    for (const code of ['auth-present', 'demo-school-present', 'service-account-ready'])
      expect(doctor.doctor?.findings.some(entry => entry.code === code)).toBe(true)
  })

  it('recovers an interrupted portrait and a lost completion response through real HTTP commands', async () => {
    const ownerId = demoCiDataset.entities.guardians![0]!.id
    const body = new Uint8Array(await readFile(resolveProfilePicturePath(profilePictureForOwner('guardian', ownerId))))
    const attachmentId = `${buildSeedProfileAttachmentId('guardian', ownerId)}-interrupted`
    const apiUrl = createHttpClientForApp(context.app).origin
    const headers = { 'authorization': `Bearer ${serviceAccountApiKey}`, 'content-type': 'application/json' }
    const input = { attachmentId, ownerKind: AttachmentOwnerKind.Guardian, ownerId, fileName: 'profile.jpg', mimeType: 'image/jpeg', sizeBytes: body.byteLength }
    const started = await createHttpClientForApp(context.app).request('/core/commands/create-profile-photo-upload', { method: 'POST', headers, body: JSON.stringify({ ...input, sizeBytes: body.byteLength + 1 }) })
    expect(started.status).toBe(200)
    let lostCompletion = false
    let creates = 0
    let completions = 0
    const client = new HttpSeedClient({ baseUrl: apiUrl, fetch: async (url, init) => {
      const target = new URL(String(url))
      if (target.origin !== apiUrl)
        return fetch(url, init)
      if (target.pathname.endsWith('create-profile-photo-upload'))
        creates++
      const response = await context.app.request(`${target.pathname}${target.search}`, init)
      if (target.pathname.endsWith('complete-profile-photo-upload')) {
        completions++
        if (response.ok && !lostCompletion) {
          lostCompletion = true
          await response.body?.cancel()
          throw Object.assign(new Error('Lost completion response'), { code: 'ECONNRESET' })
        }
      }
      return response
    } })
    const port = createHttpProfilePicturesSeedPort({ client, serviceAccountApiKey })
    const upload = { ...input, schoolId: demoCiDataset.schoolId, body }
    const recovered = await port.uploadProfilePhoto(upload)
    expect(recovered.attachmentId).toStartWith(`${attachmentId}-retry-`)
    expect(creates).toBe(2)
    expect(completions).toBe(2)
    await port.setGuardianPhotoUrl(ownerId, recovered.photoUrl)
    expect(await port.uploadProfilePhoto(upload)).toEqual(recovered)
    expect(creates).toBe(2)
    expect(completions).toBe(2)
  })
})
