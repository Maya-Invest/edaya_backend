import type { EffectiveGrants, InteractiveActorMetadata, SchoolRepositories } from '@edaya/core'
import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'node:crypto'
import {
  ActorAssuranceLevel,
  createGuardianActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,

} from '@edaya/core'

export interface AuthSession {
  user: {
    id: string
  }
  session: {
    id?: string
    createdAt: string | Date
    assuranceLevel?: ActorAssuranceLevel | string
  }
}

export interface AuthSessionProvider {
  api: {
    getSession: (args: { headers: Headers }) => Promise<AuthSession | null | undefined>
  }
}

export interface SessionActorBindings {
  Variables: {
    actor: InteractiveActorMetadata | null
    schoolApp: {
      repositories: SchoolRepositories
    }
  }
}

type ActorIdentity
  = | {
    kind: 'staff'
    schoolId: string
    staffMemberId: string
  }
  | {
    kind: 'guardian'
    schoolId: string
    guardianId: string
  }
  | {
    kind: 'student'
    schoolId: string
    studentId: string
  }

function normalizeAssuranceLevel(input: unknown): ActorAssuranceLevel {
  if (input === ActorAssuranceLevel.Verified || input === ActorAssuranceLevel.Strong) {
    return input
  }
  return ActorAssuranceLevel.Standard
}

function normalizeAuthSession(input: AuthSession | null | undefined) {
  if (!input || typeof input !== 'object') {
    return null
  }

  if (!input.user || typeof input.user.id !== 'string' || input.user.id.trim() === '') {
    return null
  }

  if (!input.session || !('createdAt' in input.session)) {
    return null
  }

  const authenticatedAt = new Date(input.session.createdAt)
  if (Number.isNaN(authenticatedAt.getTime())) {
    return null
  }

  return {
    user: {
      id: input.user.id,
    },
    session: {
      ...(input.session.id ? { id: input.session.id } : {}),
      createdAt: authenticatedAt,
      assuranceLevel: normalizeAssuranceLevel(input.session.assuranceLevel),
    },
  }
}

async function resolveActorIdentity(
  repos: SchoolRepositories,
  subjectId: string,
  academicYearId: string | undefined,
): Promise<(ActorIdentity & { effectiveGrants: EffectiveGrants }) | null> {
  const [staff, guardian, student] = await Promise.all([
    repos.staffMembers.findOne({ subjectId }),
    repos.guardians.findOne({ subjectId }),
    repos.students.findOne({ subjectId }),
  ])

  const identities: ActorIdentity[] = []

  if (staff) {
    identities.push({
      kind: 'staff',
      schoolId: staff.schoolId,
      staffMemberId: staff.id,
    })
  }

  if (guardian) {
    identities.push({
      kind: 'guardian',
      schoolId: guardian.schoolId,
      guardianId: guardian.id,
    })
  }

  if (student) {
    identities.push({
      kind: 'student',
      schoolId: student.schoolId,
      studentId: student.id,
    })
  }

  if (identities.length !== 1) {
    return null
  }

  const [identity] = identities
  if (!identity) {
    return null
  }

  const actorId
    = identity.kind === 'staff'
      ? identity.staffMemberId
      : identity.kind === 'guardian'
        ? identity.guardianId
        : identity.studentId

  const effectiveGrants = await repos.authorization.resolveActorGrants({
    actorId,
    actorType: identity.kind,
    schoolId: identity.schoolId,
    ...(academicYearId ? { academicYearId } : {}),
  })

  return {
    ...identity,
    effectiveGrants,
  }
}

export function createSessionActorMiddleware(
  auth: AuthSessionProvider,
): MiddlewareHandler<SessionActorBindings> {
  return async (c, next) => {
    const session = normalizeAuthSession(await auth.api.getSession({
      headers: c.req.raw.headers,
    }))

    if (!session) {
      c.set('actor', null)
      await next()
      return
    }

    const academicYearId = c.req.header('x-academic-year-id')?.trim() || undefined
    const interactiveContext = {
      subjectId: session.user.id,
      requestId: c.req.header('x-request-id')?.trim() || randomUUID(),
      ...(session.session.id ? { sessionId: session.session.id } : {}),
      authenticatedAt: session.session.createdAt,
      assuranceLevel: session.session.assuranceLevel,
    }

    const identity = await resolveActorIdentity(
      c.var.schoolApp.repositories,
      session.user.id,
      academicYearId,
    )

    if (!identity) {
      c.set('actor', null)
      await next()
      return
    }

    switch (identity.kind) {
      case 'staff':
        c.set('actor', createStaffActorMetadata({
          ...interactiveContext,
          schoolId: identity.schoolId,
          staffMemberId: identity.staffMemberId,
          effectiveGrants: identity.effectiveGrants,
        }))
        break
      case 'guardian':
        c.set('actor', createGuardianActorMetadata({
          ...interactiveContext,
          schoolId: identity.schoolId,
          guardianId: identity.guardianId,
          effectiveGrants: identity.effectiveGrants,
        }))
        break
      case 'student':
        c.set('actor', createStudentActorMetadata({
          ...interactiveContext,
          schoolId: identity.schoolId,
          studentId: identity.studentId,
          effectiveGrants: identity.effectiveGrants,
        }))
        break
    }

    await next()
  }
}
