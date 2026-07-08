import type { EffectiveGrants, GuardianScope, InteractiveActorMetadata, StudentScope, TeacherActorScope } from '@edaya/authorization'
import type { SchoolRepositories } from '@edaya/school-service'
import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'node:crypto'
import { ActorAssuranceLevel, createGuardianActorMetadata, createStaffActorMetadata, createStudentActorMetadata, createTeacherActorMetadata, parseInteractiveActorKind, resolveActorScope, resolveInteractiveActorIdentity } from '@edaya/authorization'

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
    effectiveGrants: EffectiveGrants
  }
  | {
    kind: 'guardian'
    schoolId: string
    guardianId: string
    guardianScope: GuardianScope
  }
  | {
    kind: 'student'
    schoolId: string
    studentId: string
    studentScope: StudentScope
  }
  | {
    kind: 'teacher'
    schoolId: string
    teacherId: string
    teacherScope: TeacherActorScope
  }

async function resolveActorIdentity(
  repos: SchoolRepositories,
  subjectId: string,
  academicYearId: string | undefined,
  resolution: {
    actorKind?: ReturnType<typeof parseInteractiveActorKind>
    schoolId?: string
    actorId?: string
  },
): Promise<ActorIdentity | null> {
  const resolved = await resolveInteractiveActorIdentity(repos, {
    subjectId,
    ...(resolution.actorKind ? { actorKind: resolution.actorKind } : {}),
    ...(resolution.schoolId ? { schoolId: resolution.schoolId } : {}),
    ...(resolution.actorId ? { actorId: resolution.actorId } : {}),
  })

  if (!resolved) {
    return null
  }

  if (resolved.kind === 'staff') {
    const effectiveGrants = await repos.authorization.resolveActorGrants({
      actorId: resolved.actorId,
      actorType: resolved.kind,
      schoolId: resolved.schoolId,
      ...(academicYearId ? { academicYearId } : {}),
    })

    return {
      kind: 'staff',
      schoolId: resolved.schoolId,
      staffMemberId: resolved.actorId,
      effectiveGrants,
    }
  }

  const scope = await resolveActorScope({
    actorKind: resolved.kind,
    actorId: resolved.actorId,
    schoolId: resolved.schoolId,
    repositories: repos,
    ...(academicYearId ? { academicYearId } : {}),
  })

  if (resolved.kind === 'guardian') {
    return {
      kind: 'guardian',
      schoolId: resolved.schoolId,
      guardianId: resolved.actorId,
      guardianScope: scope as GuardianScope,
    }
  }

  if (resolved.kind === 'student') {
    return {
      kind: 'student',
      schoolId: resolved.schoolId,
      studentId: resolved.actorId,
      studentScope: scope as StudentScope,
    }
  }

  return {
    kind: 'teacher',
    schoolId: resolved.schoolId,
    teacherId: resolved.actorId,
    teacherScope: scope as TeacherActorScope,
  }
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
      {
        actorKind: parseInteractiveActorKind(c.req.header('x-actor-kind')),
        schoolId: c.req.header('x-school-id')?.trim() || undefined,
        actorId: c.req.header('x-actor-id')?.trim() || undefined,
      },
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
          guardianScope: identity.guardianScope,
        }))
        break
      case 'student':
        c.set('actor', createStudentActorMetadata({
          ...interactiveContext,
          schoolId: identity.schoolId,
          studentId: identity.studentId,
          studentScope: identity.studentScope,
        }))
        break
      case 'teacher':
        c.set('actor', createTeacherActorMetadata({
          ...interactiveContext,
          schoolId: identity.schoolId,
          teacherId: identity.teacherId,
          teacherScope: identity.teacherScope,
        }))
        break
    }

    await next()
  }
}
