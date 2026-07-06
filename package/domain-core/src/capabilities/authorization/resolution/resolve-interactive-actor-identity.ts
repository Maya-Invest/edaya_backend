import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { InteractiveActorKind } from './interactive-actor-kind'

export interface ResolvedInteractiveActorIdentity {
  readonly kind: InteractiveActorKind
  readonly schoolId: string
  readonly actorId: string
}

export interface ResolveInteractiveActorIdentityArgs {
  subjectId: string
  actorKind?: InteractiveActorKind
  schoolId?: string
  actorId?: string
}

type ActorRepositories = Pick<SchoolRepositories, 'staffMembers' | 'guardians' | 'students' | 'teachers'>

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
  if (identities.length !== 1) {
    return null
  }

  return identities[0] ?? null
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

  const identities = (await listIdentitiesForSubject(repositories, args.subjectId))
    .filter(identity => identity.kind === args.actorKind)

  const scoped = args.schoolId
    ? identities.filter(identity => identity.schoolId === args.schoolId)
    : identities

  if (scoped.length !== 1) {
    return null
  }

  return scoped[0] ?? null
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
      if (!guardian || guardian.subjectId !== args.subjectId) {
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
  }
}

async function listIdentitiesForSubject(
  repositories: ActorRepositories,
  subjectId: string,
): Promise<ResolvedInteractiveActorIdentity[]> {
  const [staff, guardian, student, teacher] = await Promise.all([
    repositories.staffMembers.findOne({ subjectId }),
    repositories.guardians.findOne({ subjectId }),
    repositories.students.findOne({ subjectId }),
    repositories.teachers.findOne({ subjectId }),
  ])

  const identities: ResolvedInteractiveActorIdentity[] = []

  if (staff) {
    identities.push({ kind: 'staff', schoolId: staff.schoolId, actorId: staff.id })
  }

  if (guardian) {
    identities.push({ kind: 'guardian', schoolId: guardian.schoolId, actorId: guardian.id })
  }

  if (student) {
    identities.push({ kind: 'student', schoolId: student.schoolId, actorId: student.id })
  }

  if (teacher?.isActive) {
    identities.push({ kind: 'teacher', schoolId: teacher.schoolId, actorId: teacher.id })
  }

  return identities
}
