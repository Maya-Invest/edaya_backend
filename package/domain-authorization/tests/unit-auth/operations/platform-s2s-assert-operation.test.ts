import {
  ActorAssuranceLevel,
  assertOperation,
  AuthorizationError,
  createPlatformActorMetadata,
  createS2sActorMetadata,
  PlatformOperations,
  PlatformUserOperations,
  S2sClientOperations,
  ServiceAccountOperations,
  StudentOperations,
} from '@edaya/authorization'
import { ALL_PLATFORM_PERMISSIONS, PlatformPermission } from '@edaya/core'
import { describe, expect, test } from 'bun:test'

const now = new Date('2026-09-01T00:00:00Z')

function platformActor(permissions: readonly PlatformPermission[] = ALL_PLATFORM_PERMISSIONS) {
  return createPlatformActorMetadata({
    subjectId: 'subject-op',
    actorId: 'platform-op',
    requestId: 'test',
    authenticatedAt: now,
    assuranceLevel: ActorAssuranceLevel.Verified,
    permissions,
    email: 'op@edaya.test',
  })
}

function s2sActor(accessClass: 'read' | 'write') {
  return createS2sActorMetadata({
    actorId: 's2s-1',
    schoolId: 'school-1',
    requestId: 'test',
    clientId: 'children-ai',
    accessClass,
  })
}

describe('assertOperation platform and s2s', () => {
  test('platform actors use platform permissions and cannot run school entity ops', () => {
    expect(() => assertOperation(platformActor(), PlatformUserOperations.read)).not.toThrow()
    expect(() => assertOperation(
      platformActor([PlatformPermission.S2S_CLIENT_READ]),
      PlatformUserOperations.create,
    )).toThrow(AuthorizationError)
    expect(() => assertOperation(platformActor(), StudentOperations.directoryRead)).toThrow(AuthorizationError)
  })

  test('s2s read keys may query and cannot mutate or administer keys', () => {
    expect(() => assertOperation(s2sActor('read'), StudentOperations.directoryRead)).not.toThrow()
    expect(() => assertOperation(s2sActor('read'), StudentOperations.update)).toThrow(AuthorizationError)
    expect(() => assertOperation(s2sActor('read'), S2sClientOperations.create)).toThrow(AuthorizationError)
    expect(() => assertOperation(s2sActor('read'), ServiceAccountOperations.create)).toThrow(AuthorizationError)
  })

  test('s2s write keys may mutate school entities but cannot mint keys or register schools', () => {
    expect(() => assertOperation(s2sActor('write'), StudentOperations.directoryRead)).not.toThrow()
    expect(() => assertOperation(s2sActor('write'), StudentOperations.update)).not.toThrow()
    expect(() => assertOperation(s2sActor('write'), ServiceAccountOperations.create)).toThrow(AuthorizationError)
    expect(() => assertOperation(s2sActor('write'), PlatformOperations.registerSchool)).toThrow(AuthorizationError)
    expect(() => assertOperation(s2sActor('write'), PlatformUserOperations.create)).toThrow(AuthorizationError)
  })

  test('unknown actor kinds are denied', () => {
    expect(() => assertOperation(
      { kind: 'unknown' } as never,
      StudentOperations.directoryRead,
    )).toThrow(AuthorizationError)
  })
})
