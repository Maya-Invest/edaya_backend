import { describe, expect, test } from 'bun:test'
import { resolveInteractiveActorIdentity } from '../../../src/capabilities/authorization/resolution/resolve-interactive-actor-identity'

describe('resolveInteractiveActorIdentity', () => {
  test('resolves a single identity without X-Actor-Kind', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => ({ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }),
      },
      guardians: { findOne: async () => undefined },
      students: { findOne: async () => undefined },
      teachers: { findOne: async () => undefined },
    }

    await expect(resolveInteractiveActorIdentity(repositories as never, {
      subjectId: 'user-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'staff-1',
    })
  })

  test('returns null when multiple kinds share a subject without X-Actor-Kind', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => ({ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }),
      },
      guardians: {
        findOne: async () => ({ id: 'guardian-1', schoolId: 'school-1', subjectId: 'user-1' }),
      },
      students: { findOne: async () => undefined },
      teachers: { findOne: async () => undefined },
    }

    await expect(resolveInteractiveActorIdentity(repositories as never, {
      subjectId: 'user-1',
    })).resolves.toBeNull()
  })

  test('resolves staff when X-Actor-Kind is staff and guardian also exists', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => ({ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }),
        findById: async () => undefined,
      },
      guardians: {
        findOne: async () => ({ id: 'guardian-1', schoolId: 'school-1', subjectId: 'user-1' }),
      },
      students: { findOne: async () => undefined },
      teachers: { findOne: async () => undefined },
    }

    await expect(resolveInteractiveActorIdentity(repositories as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      schoolId: 'school-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'staff-1',
    })
  })

  test('resolves teacher when X-Actor-Kind is teacher and staff also exists', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => ({ id: 'ci-st3', schoolId: 'school-1', subjectId: 'user-1' }),
        findById: async () => undefined,
      },
      guardians: { findOne: async () => undefined },
      students: { findOne: async () => undefined },
      teachers: {
        findOne: async () => ({ id: 'ci-t1', schoolId: 'school-1', subjectId: 'user-1', isActive: true }),
        findById: async () => undefined,
      },
    }

    await expect(resolveInteractiveActorIdentity(repositories as never, {
      subjectId: 'user-1',
      actorKind: 'teacher',
      schoolId: 'school-1',
    })).resolves.toEqual({
      kind: 'teacher',
      schoolId: 'school-1',
      actorId: 'ci-t1',
    })

    await expect(resolveInteractiveActorIdentity(repositories as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      schoolId: 'school-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'ci-st3',
    })
  })

  test('returns null when staff and teacher share a subject without X-Actor-Kind', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => ({ id: 'ci-st3', schoolId: 'school-1', subjectId: 'user-1' }),
      },
      guardians: { findOne: async () => undefined },
      students: { findOne: async () => undefined },
      teachers: {
        findOne: async () => ({ id: 'ci-t1', schoolId: 'school-1', subjectId: 'user-1', isActive: true }),
      },
    }

    await expect(resolveInteractiveActorIdentity(repositories as never, {
      subjectId: 'user-1',
    })).resolves.toBeNull()
  })

  test('resolves by explicit actor id', async () => {
    const repositories = {
      staffMembers: {
        findOne: async () => undefined,
        findById: async (id: string) => id === 'staff-2'
          ? { id: 'staff-2', schoolId: 'school-2', subjectId: 'user-1' }
          : undefined,
      },
      guardians: { findOne: async () => undefined },
      students: { findOne: async () => undefined },
      teachers: { findOne: async () => undefined },
    }

    await expect(resolveInteractiveActorIdentity(repositories as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      actorId: 'staff-2',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-2',
      actorId: 'staff-2',
    })
  })
})
