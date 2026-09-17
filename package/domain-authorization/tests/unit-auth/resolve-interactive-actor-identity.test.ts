import { describe, expect, test } from 'bun:test'
import { listIdentitiesForSubject, resolveInteractiveActorIdentity } from '../../src/access/identity'

function repositories(rows: {
  staff?: Array<{ id: string, schoolId: string, subjectId: string }>
  guardians?: Array<{ id: string, schoolId: string, subjectId: string, hasAccess: boolean }>
  students?: Array<{ id: string, schoolId: string, subjectId: string }>
  teachers?: Array<{ id: string, schoolId: string, subjectId: string, isActive: boolean }>
}) {
  const staff = rows.staff ?? []
  const guardians = rows.guardians ?? []
  const students = rows.students ?? []
  const teachers = rows.teachers ?? []

  return {
    staffMembers: {
      list: async (filter: { subjectId: string, schoolId?: string }) => staff.filter(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findOne: async (filter: { subjectId: string, schoolId?: string }) => staff.find(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findById: async (id: string) => staff.find(row => row.id === id),
    },
    guardians: {
      list: async (filter: { subjectId: string, schoolId?: string }) => guardians.filter(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findOne: async (filter: { subjectId: string, schoolId?: string }) => guardians.find(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findById: async (id: string) => guardians.find(row => row.id === id),
    },
    students: {
      list: async (filter: { subjectId: string, schoolId?: string }) => students.filter(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findOne: async (filter: { subjectId: string, schoolId?: string }) => students.find(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findById: async (id: string) => students.find(row => row.id === id),
    },
    teachers: {
      list: async (filter: { subjectId: string, schoolId?: string }) => teachers.filter(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findOne: async (filter: { subjectId: string, schoolId?: string }) => teachers.find(row =>
        row.subjectId === filter.subjectId && (!filter.schoolId || row.schoolId === filter.schoolId),
      ),
      findById: async (id: string) => teachers.find(row => row.id === id),
    },
  }
}

describe('resolveInteractiveActorIdentity', () => {
  test('resolves a single identity without X-Actor-Kind', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [{ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }],
    }) as never, {
      subjectId: 'user-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'staff-1',
    })
  })

  test('prefers the unique staff membership when other kinds share a subject without X-Actor-Kind', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [{ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }],
      guardians: [{ id: 'guardian-1', hasAccess: true, schoolId: 'school-1', subjectId: 'user-1' }],
    }) as never, {
      subjectId: 'user-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'staff-1',
    })
  })

  test('resolves staff when X-Actor-Kind is staff and guardian also exists', async () => {
    const guardianList = async () => {
      throw new Error('guardian list should not run when actorKind is staff')
    }
    const staff = [{ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }]
    const repos = {
      staffMembers: {
        list: async () => staff,
        findOne: async () => staff[0],
        findById: async () => undefined,
      },
      guardians: {
        list: guardianList,
        findOne: guardianList,
      },
      students: { list: async () => [], findOne: async () => undefined },
      teachers: { list: async () => [], findOne: async () => undefined },
    }

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      schoolId: 'school-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'staff-1',
    })
  })

  test('queries only the matching actor table when X-Actor-Kind is set without X-Actor-Id', async () => {
    const calls = {
      staff: 0,
      guardian: 0,
      student: 0,
      teacher: 0,
    }
    const repos = {
      staffMembers: {
        list: async () => {
          calls.staff += 1
          return [{ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }]
        },
        findOne: async () => undefined,
        findById: async () => undefined,
      },
      guardians: {
        list: async () => {
          calls.guardian += 1
          return [{ id: 'guardian-1', hasAccess: true, schoolId: 'school-1', subjectId: 'user-1' }]
        },
      },
      students: {
        list: async () => {
          calls.student += 1
          return []
        },
      },
      teachers: {
        list: async () => {
          calls.teacher += 1
          return []
        },
      },
    }

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      schoolId: 'school-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'staff-1',
    })

    expect(calls).toEqual({ staff: 1, guardian: 0, student: 0, teacher: 0 })
  })

  test('resolves teacher when X-Actor-Kind is teacher and staff also exists', async () => {
    const repos = repositories({
      staff: [{ id: 'ci-st3', schoolId: 'school-1', subjectId: 'user-1' }],
      teachers: [{ id: 'ci-t1', schoolId: 'school-1', subjectId: 'user-1', isActive: true }],
    })

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'teacher',
      schoolId: 'school-1',
    })).resolves.toEqual({
      kind: 'teacher',
      schoolId: 'school-1',
      actorId: 'ci-t1',
    })

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      schoolId: 'school-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'ci-st3',
    })
  })

  test('prefers unique staff when staff and teacher share a subject without X-Actor-Kind', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [{ id: 'ci-st3', schoolId: 'school-1', subjectId: 'user-1' }],
      teachers: [{ id: 'ci-t1', schoolId: 'school-1', subjectId: 'user-1', isActive: true }],
    }) as never, {
      subjectId: 'user-1',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-1',
      actorId: 'ci-st3',
    })
  })

  test('returns null when two staff schools exist without X-School-Id', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [
        { id: 'staff-a', schoolId: 'school-a', subjectId: 'user-1' },
        { id: 'staff-b', schoolId: 'school-b', subjectId: 'user-1' },
      ],
    }) as never, {
      subjectId: 'user-1',
    })).resolves.toBeNull()

    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [
        { id: 'staff-a', schoolId: 'school-a', subjectId: 'user-1' },
        { id: 'staff-b', schoolId: 'school-b', subjectId: 'user-1' },
      ],
    }) as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
    })).resolves.toBeNull()
  })

  test('resolves a staff school when X-School-Id disambiguates two memberships', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [
        { id: 'staff-a', schoolId: 'school-a', subjectId: 'user-1' },
        { id: 'staff-b', schoolId: 'school-b', subjectId: 'user-1' },
      ],
    }) as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      schoolId: 'school-b',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-b',
      actorId: 'staff-b',
    })
  })

  test('lists every staff school for a subject', async () => {
    await expect(listIdentitiesForSubject(repositories({
      staff: [
        { id: 'staff-a', schoolId: 'school-a', subjectId: 'user-1' },
        { id: 'staff-b', schoolId: 'school-b', subjectId: 'user-1' },
      ],
      teachers: [{ id: 'teacher-a', schoolId: 'school-a', subjectId: 'user-1', isActive: true }],
    }) as never, 'user-1')).resolves.toEqual([
      { kind: 'staff', schoolId: 'school-a', actorId: 'staff-a' },
      { kind: 'staff', schoolId: 'school-b', actorId: 'staff-b' },
      { kind: 'teacher', schoolId: 'school-a', actorId: 'teacher-a' },
    ])
  })

  test('resolves by explicit actor id', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [{ id: 'staff-2', schoolId: 'school-2', subjectId: 'user-1' }],
    }) as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      actorId: 'staff-2',
    })).resolves.toEqual({
      kind: 'staff',
      schoolId: 'school-2',
      actorId: 'staff-2',
    })
  })

  test('resolves guardian and student identities by explicit actor id', async () => {
    const repos = repositories({
      guardians: [{ id: 'guardian-1', hasAccess: true, schoolId: 'school-1', subjectId: 'user-1' }],
      students: [{ id: 'student-1', schoolId: 'school-1', subjectId: 'user-1' }],
    })

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'guardian',
      actorId: 'guardian-1',
    })).resolves.toEqual({
      kind: 'guardian',
      schoolId: 'school-1',
      actorId: 'guardian-1',
    })

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'student',
      actorId: 'student-1',
    })).resolves.toEqual({
      kind: 'student',
      schoolId: 'school-1',
      actorId: 'student-1',
    })
  })

  test('returns null when explicit actor id does not match subject or school', async () => {
    const repos = repositories({
      staff: [{ id: 'staff-2', schoolId: 'school-2', subjectId: 'other-subject' }],
      teachers: [{ id: 'teacher-1', schoolId: 'school-1', subjectId: 'user-1', isActive: false }],
    })

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      actorId: 'staff-2',
      schoolId: 'school-1',
    })).resolves.toBeNull()

    await expect(resolveInteractiveActorIdentity(repos as never, {
      subjectId: 'user-1',
      actorKind: 'teacher',
      actorId: 'teacher-1',
    })).resolves.toBeNull()
  })

  test('returns null when actor kind filter matches multiple schools', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [{ id: 'staff-a', schoolId: 'school-a', subjectId: 'user-1' }],
    }) as never, {
      subjectId: 'user-1',
      actorKind: 'staff',
      schoolId: 'school-b',
    })).resolves.toBeNull()
  })

  test('does not resolve school identities for X-Actor-Kind platform', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      staff: [{ id: 'staff-1', schoolId: 'school-1', subjectId: 'user-1' }],
    }) as never, {
      subjectId: 'user-1',
      actorKind: 'platform',
    })).resolves.toBeNull()
  })

  test('resolves a unique non-staff identity when no staff membership exists', async () => {
    await expect(resolveInteractiveActorIdentity(repositories({
      guardians: [{ id: 'guardian-1', hasAccess: true, schoolId: 'school-1', subjectId: 'user-1' }],
    }) as never, {
      subjectId: 'user-1',
    })).resolves.toEqual({
      kind: 'guardian',
      schoolId: 'school-1',
      actorId: 'guardian-1',
    })
  })
})
