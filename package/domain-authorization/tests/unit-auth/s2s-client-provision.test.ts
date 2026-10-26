import {
  ActorAssuranceLevel,
  createPlatformActorMetadata,
  createS2sClient,
  listS2sClients,
  revokeS2sClient,
  rotateS2sClientKey,
  S2S_API_KEY_PREFIX,
} from '@edaya/authorization'
import { ALL_PLATFORM_PERMISSIONS, PlatformUser } from '@edaya/core'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { createAuthorizationDatabase } from '../../../adaptor-postgres/tests/support/authorization-database'

let fixture: Awaited<ReturnType<typeof createAuthorizationDatabase>>
const actor = createPlatformActorMetadata({ subjectId: 'subject-op', actorId: 'platform-op', requestId: 'test', authenticatedAt: new Date(), assuranceLevel: ActorAssuranceLevel.Verified, email: 'op@edaya.test' })
beforeEach(async () => {
  fixture = await createAuthorizationDatabase()
  await fixture.repositories.platformUsers.save(new PlatformUser({ id: actor.actorId, subjectId: actor.subjectId, email: actor.email, permissions: [...ALL_PLATFORM_PERMISSIONS], isActive: true, createdBySubjectId: 'bootstrap' }))
})
afterEach(async () => {
  await fixture.db.close()
})

describe('s2s client provision', () => {
  test('mints, lists, rotates, and revokes a per-school key', async () => {
    const { repositories: repository, atomic } = fixture
    const created = await createS2sClient(repository, actor, {
      schoolId: 'school-a',
      clientId: 'edaya-spark',
      accessClass: 'read',
    }, atomic)

    expect(created.apiKey.startsWith(S2S_API_KEY_PREFIX)).toBe(true)
    expect(created.client.schoolId).toBe('school-a')
    expect(created.client.accessClass).toBe('read')

    const listed = await listS2sClients(repository, actor, 'school-a')
    expect(listed).toHaveLength(1)

    const rotated = await rotateS2sClientKey(repository, actor, created.client.id, undefined, atomic)
    expect(rotated.apiKey).not.toBe(created.apiKey)
    expect(rotated.client.keyHash).not.toBe(created.client.keyHash)

    const revoked = await revokeS2sClient(repository, actor, created.client.id, atomic)
    expect(revoked.isActive()).toBe(false)
    await expect(rotateS2sClientKey(repository, actor, created.client.id, undefined, atomic))
      .rejects
      .toMatchObject({ code: 'S2S_CLIENT_NOT_FOUND' })
  })

  test('rejects a second active client with the same school and clientId', async () => {
    const { repositories: repository, atomic } = fixture
    await createS2sClient(repository, actor, {
      schoolId: 'school-a',
      clientId: 'edaya-spark',
      accessClass: 'write',
      apiKey: `${S2S_API_KEY_PREFIX}fixed-s2s-key-16xx`,
    }, atomic)
    await expect(createS2sClient(repository, actor, {
      schoolId: 'school-a',
      clientId: 'edaya-spark',
      accessClass: 'read',
    }, atomic)).rejects.toMatchObject({ code: 'S2S_CLIENT_ID_CONFLICT' })
  })
})
