import type { AuthorizationRepositories } from '../ports/authorization-repositories';
import type { InteractiveActorKind } from './interactive-actor-kind';

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
      const staff = await repositories.staffMembers.findOne(filter)
      if (!staff || (args.schoolId && staff.schoolId !== args.schoolId)) {
        return null
      }
      return { kind: 'staff', schoolId: staff.schoolId, actorId: staff.id }
    }
    case 'guardian': {
      const guardian = await repositories.guardians.findOne(filter)
      if (!guardian?.hasAccess || (args.schoolId && guardian.schoolId !== args.schoolId)) {
        return null
      }
      return { kind: 'guardian', schoolId: guardian.schoolId, actorId: guardian.id }
    }
    case 'student': {
      const student = await repositories.students.findOne(filter)
      if (!student || (args.schoolId && student.schoolId !== args.schoolId)) {
        return null
      }
      return { kind: 'student', schoolId: student.schoolId, actorId: student.id }
    }
    case 'teacher': {
      const teacher = await repositories.teachers.findOne(filter)
      if (!teacher?.isActive || (args.schoolId && teacher.schoolId !== args.schoolId)) {
        return null
      }
      return { kind: 'teacher', schoolId: teacher.schoolId, actorId: teacher.id }
    }
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

  if (guardian?.hasAccess) {
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
