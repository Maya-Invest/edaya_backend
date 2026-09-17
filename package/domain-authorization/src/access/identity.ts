import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import type { InteractiveActorKind } from './interactive-actor-kind'

export interface ResolvedInteractiveActorIdentity {
  readonly kind: Exclude<InteractiveActorKind, 'platform'>
  readonly schoolId: string
  readonly actorId: string
}

export interface ResolveInteractiveActorIdentityArgs {
  subjectId: string
  actorKind?: InteractiveActorKind
  schoolId?: string
  actorId?: string
}

type ActorRepositories = Pick<AuthorizationRepositories, 'staffMembers' | 'guardians' | 'students' | 'teachers'>

export async function resolveInteractiveActorIdentity(
  repositories: ActorRepositories,
  args: ResolveInteractiveActorIdentityArgs,
): Promise<ResolvedInteractiveActorIdentity | null> {
  if (args.actorKind) {
    return resolveByActorKind(repositories, {
      ...args,
      actorKind: args.actorKind,
    })
  }

  const identities = await listIdentitiesForSubject(repositories, args.subjectId)
  return pickDefaultIdentity(identities)
}

async function resolveByActorKind(
  repositories: ActorRepositories,
  args: ResolveInteractiveActorIdentityArgs & { actorKind: InteractiveActorKind },
): Promise<ResolvedInteractiveActorIdentity | null> {
  if (args.actorId) {
    return resolveByActorKindAndId(repositories, {
      ...args,
      actorKind: args.actorKind,
      actorId: args.actorId,
    })
  }

  return resolveByActorKindAndSubject(repositories, {
    subjectId: args.subjectId,
    actorKind: args.actorKind,
    ...(args.schoolId ? { schoolId: args.schoolId } : {}),
  })
}

async function resolveByActorKindAndSubject(
  repositories: ActorRepositories,
  args: {
    subjectId: string
    actorKind: InteractiveActorKind
    schoolId?: string
  },
): Promise<ResolvedInteractiveActorIdentity | null> {
  const filter = args.schoolId
    ? { subjectId: args.subjectId, schoolId: args.schoolId }
    : { subjectId: args.subjectId }

  switch (args.actorKind) {
    case 'staff': {
      const matches = await listKindIdentities(repositories.staffMembers, filter, staff => ({
        kind: 'staff' as const,
        schoolId: staff.schoolId,
        actorId: staff.id,
      }))
      return pickUniqueKindIdentity(matches, args.schoolId)
    }
    case 'guardian': {
      const matches = await listKindIdentities(repositories.guardians, filter, guardian => (
        guardian.hasAccess
          ? { kind: 'guardian' as const, schoolId: guardian.schoolId, actorId: guardian.id }
          : null
      ))
      return pickUniqueKindIdentity(matches, args.schoolId)
    }
    case 'student': {
      const matches = await listKindIdentities(repositories.students, filter, student => ({
        kind: 'student' as const,
        schoolId: student.schoolId,
        actorId: student.id,
      }))
      return pickUniqueKindIdentity(matches, args.schoolId)
    }
    case 'teacher': {
      const matches = await listKindIdentities(repositories.teachers, filter, teacher => (
        teacher.isActive
          ? { kind: 'teacher' as const, schoolId: teacher.schoolId, actorId: teacher.id }
          : null
      ))
      return pickUniqueKindIdentity(matches, args.schoolId)
    }
    case 'platform':
      return null
  }
}

async function resolveByActorKindAndId(
  repositories: ActorRepositories,
  args: ResolveInteractiveActorIdentityArgs & { actorKind: InteractiveActorKind, actorId: string },
): Promise<ResolvedInteractiveActorIdentity | null> {
  switch (args.actorKind) {
    case 'staff': {
      const staff = await repositories.staffMembers.findById(args.actorId)
      if (!staff || staff.subjectId !== args.subjectId) {
        return null
      }
      if (args.schoolId && staff.schoolId !== args.schoolId) {
        return null
      }
      return { kind: 'staff', schoolId: staff.schoolId, actorId: staff.id }
    }
    case 'guardian': {
      const guardian = await repositories.guardians.findById(args.actorId)
      if (!guardian?.hasAccess || guardian.subjectId !== args.subjectId) {
        return null
      }
      if (args.schoolId && guardian.schoolId !== args.schoolId) {
        return null
      }
      return { kind: 'guardian', schoolId: guardian.schoolId, actorId: guardian.id }
    }
    case 'student': {
      const student = await repositories.students.findById(args.actorId)
      if (!student || student.subjectId !== args.subjectId) {
        return null
      }
      if (args.schoolId && student.schoolId !== args.schoolId) {
        return null
      }
      return { kind: 'student', schoolId: student.schoolId, actorId: student.id }
    }
    case 'teacher': {
      const teacher = await repositories.teachers.findById(args.actorId)
      if (!teacher || teacher.subjectId !== args.subjectId || !teacher.isActive) {
        return null
      }
      if (args.schoolId && teacher.schoolId !== args.schoolId) {
        return null
      }
      return { kind: 'teacher', schoolId: teacher.schoolId, actorId: teacher.id }
    }
    case 'platform':
      return null
  }
}

export async function subjectHasSchoolInteractiveIdentity(
  repositories: ActorRepositories,
  subjectId: string,
): Promise<boolean> {
  const identities = await listIdentitiesForSubject(repositories, subjectId)
  return identities.length > 0
}

export async function listIdentitiesForSubject(
  repositories: ActorRepositories,
  subjectId: string,
): Promise<ResolvedInteractiveActorIdentity[]> {
  const filter = { subjectId }
  const [staff, guardians, students, teachers] = await Promise.all([
    listKindIdentities(repositories.staffMembers, filter, member => ({
      kind: 'staff' as const,
      schoolId: member.schoolId,
      actorId: member.id,
    })),
    listKindIdentities(repositories.guardians, filter, guardian => (
      guardian.hasAccess
        ? { kind: 'guardian' as const, schoolId: guardian.schoolId, actorId: guardian.id }
        : null
    )),
    listKindIdentities(repositories.students, filter, student => ({
      kind: 'student' as const,
      schoolId: student.schoolId,
      actorId: student.id,
    })),
    listKindIdentities(repositories.teachers, filter, teacher => (
      teacher.isActive
        ? { kind: 'teacher' as const, schoolId: teacher.schoolId, actorId: teacher.id }
        : null
    )),
  ])

  return [...staff, ...guardians, ...students, ...teachers]
}

function pickDefaultIdentity(
  identities: ResolvedInteractiveActorIdentity[],
): ResolvedInteractiveActorIdentity | null {
  const staff = identities.filter(identity => identity.kind === 'staff')
  if (staff.length === 1) {
    return staff[0] ?? null
  }
  if (staff.length > 1) {
    return null
  }

  const others = identities.filter(identity => identity.kind !== 'staff')
  return others.length === 1 ? others[0] ?? null : null
}

function pickUniqueKindIdentity(
  identities: ResolvedInteractiveActorIdentity[],
  schoolId?: string,
): ResolvedInteractiveActorIdentity | null {
  const matches = schoolId
    ? identities.filter(identity => identity.schoolId === schoolId)
    : identities
  return matches.length === 1 ? matches[0] ?? null : null
}

async function listKindIdentities<T extends { id: string, schoolId: string }>(
  repository: { list: (filter: { subjectId: string, schoolId?: string }) => Promise<T[]> },
  filter: { subjectId: string, schoolId?: string },
  toIdentity: (entity: T) => ResolvedInteractiveActorIdentity | null,
): Promise<ResolvedInteractiveActorIdentity[]> {
  const rows = await repository.list(filter)
  return rows.flatMap((row) => {
    const identity = toIdentity(row)
    return identity ? [identity] : []
  })
}
