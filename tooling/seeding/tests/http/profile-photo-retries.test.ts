import { AttachmentOwnerKind, GUARDIAN_PORTRAIT_PURPOSE } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createHttpProfilePicturesSeedPort } from '../../src/domains/profile-pictures/adapters/http'
import { HttpSeedClient } from '../../src/transport/http/client'

const input = { attachmentId: 'att-prof-guardian-guardian', schoolId: 'school', ownerKind: AttachmentOwnerKind.Guardian, ownerId: 'guardian', fileName: 'profile.jpg', mimeType: 'image/jpeg', sizeBytes: 3, body: new Uint8Array([1, 2, 3]) }
interface Call { path: string, method: string, body: Record<string, unknown> }
function fixture(options: { conflict?: string, photoUrl?: string, ready?: boolean, fail?: (call: Call, attempt: number) => Response | undefined } = {}) {
  const calls: Call[] = []
  const attempts = new Map<string, number>()
  let photoUrl = options.photoUrl
  const client = new HttpSeedClient({ baseUrl: 'http://localhost:9999', fetch: async (url, init) => {
    const path = new URL(String(url)).pathname
    const call = { path, method: init?.method ?? 'GET', body: init?.method === 'PUT' ? {} : JSON.parse(String(init?.body ?? '{}')) }
    calls.push(call)
    const attempt = (attempts.get(path) ?? 0) + 1
    attempts.set(path, attempt)
    const failed = options.fail?.(call, attempt)
    if (failed)
      return failed
    if (path === '/core/entities/guardians/guardian')
      return Response.json({ id: 'guardian', photoUrl })
    if (path.startsWith('/core/entities/attachments/')) {
      return options.ready
        ? Response.json({ id: input.attachmentId, schoolId: input.schoolId, ownerId: input.ownerId, ownerKind: input.ownerKind, purpose: GUARDIAN_PORTRAIT_PURPOSE, status: 'ready' })
        : Response.json({}, { status: 404 })
    }
    if (path === '/core/commands/create-profile-photo-upload') {
      if (options.conflict && call.body.attachmentId === input.attachmentId)
        return Response.json({ code: options.conflict }, { status: 409 })
      return Response.json({ attachmentId: call.body.attachmentId, storageKey: `uploads/${call.body.attachmentId}`, uploadUrl: 'https://storage.example.test/upload' })
    }
    if (path === '/upload') {
      expect(new Headers(init?.headers).has('authorization')).toBe(false)
      expect(init?.body).toEqual(input.body)
      return new Response(null, { status: 204 })
    }
    if (path === '/core/commands/complete-profile-photo-upload')
      return Response.json({ id: call.body.id })
    if (path === '/core/commands/update-guardian-profile') {
      photoUrl = String(call.body.photoUrl)
      return Response.json({ id: 'guardian', photoUrl })
    }
    throw new Error(`Unexpected request ${path}`)
  } })
  return { calls, port: createHttpProfilePicturesSeedPort({ client, serviceAccountApiKey: 'fixture-key' }) }
}

describe('profile photo seed recovery', () => {
  test('published recovery portraits and completed attachments are reused without uploading', async () => {
    for (const options of [{ photoUrl: `http://localhost:9999/core/files/${input.attachmentId}-retry-existing/content` }, { ready: true }]) {
      const { port, calls } = fixture(options)
      const result = await port.uploadProfilePhoto(input)
      expect(result.attachmentId).toStartWith(input.attachmentId)
      expect(calls.every(call => call.method === 'GET')).toBe(true)
    }
  })

  test('expired and conflicting intents get a completed replacement which subsequent runs reuse', async () => {
    for (const conflict of ['ATTACHMENT_UPLOAD_EXPIRED', 'ATTACHMENT_UPLOAD_CONFLICT', 'ATTACHMENT_ALREADY_COMPLETED', 'COMMAND_REPLAY_CONFLICT']) {
      const { port, calls } = fixture({ conflict })
      const result = await port.uploadProfilePhoto(input)
      expect(result.attachmentId).toStartWith(`${input.attachmentId}-retry-`)
      expect(calls.find(call => call.path.endsWith('complete-profile-photo-upload'))?.body.id).toBe(result.attachmentId)
      await port.setGuardianPhotoUrl(input.ownerId, result.photoUrl)
      const before = calls.length
      expect(await port.uploadProfilePhoto(input)).toEqual(result)
      expect(calls.slice(before)).toHaveLength(1)
    }
  })

  test('connection loss during create, PUT or completion retries the same identity and bytes', async () => {
    for (const phase of ['/core/commands/create-profile-photo-upload', '/upload', '/core/commands/complete-profile-photo-upload']) {
      const { port, calls } = fixture({ fail(call, attempt) {
        if (call.path === phase && attempt === 1)
          throw Object.assign(new Error('Disconnected'), { code: 'ECONNRESET' })
        return undefined
      } })
      expect((await port.uploadProfilePhoto(input)).attachmentId).toBe(input.attachmentId)
      const retried = calls.filter(call => call.path === phase)
      expect(retried).toHaveLength(2)
      expect(retried[0]).toEqual(retried[1])
    }
  })

  test('unrecognized conflicts, forbidden PUTs and exhausted server errors cannot become successful photos', async () => {
    const conflict = fixture({ conflict: 'OWNER_CONFLICT' })
    await expect(conflict.port.uploadProfilePhoto(input)).rejects.toThrow()
    expect(conflict.calls.filter(call => call.path.endsWith('create-profile-photo-upload'))).toHaveLength(1)
    for (const status of [403, 503]) {
      const { port, calls } = fixture({ fail: call => call.path === '/upload' ? new Response(null, { status }) : undefined })
      await expect(port.uploadProfilePhoto(input)).rejects.toThrow()
      expect(calls.filter(call => call.path === '/upload')).toHaveLength(status === 403 ? 1 : 3)
      expect(calls.some(call => call.path.endsWith('complete-profile-photo-upload'))).toBe(false)
    }
  })
})
