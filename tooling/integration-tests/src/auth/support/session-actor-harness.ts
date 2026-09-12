import type { ActorMetadata, EffectiveGrants, GuardianScope, StudentScope, TeacherActorScope } from '@edaya/authorization'
import type { SchoolRepositories } from '@edaya/service'
import type { MiddlewareHandler } from 'hono'
import { randomUUID } from 'node:crypto'
import {
  ActorAssuranceLevel,
  bootstrapPlatformUserIfAbsent,
  createGuardianActorMetadata,
  createPlatformActorMetadata,
  createS2sActorMetadata,
  createServiceStaffActorMetadata,
  createStaffActorMetadata,
  createStudentActorMetadata,
  createTeacherActorMetadata,
  hashApiKey,
  parseBearerApiKey,
  parseBearerS2sKey,
  parseInteractiveActorKind,
  resolveActorScope,
  resolveInteractiveActorIdentity,
  subjectHasSchoolInteractiveIdentity,
} from '@edaya/authorization'

export interface AuthSession {
  user: {
    id: string
    email?: string | null
    emailVerified?: boolean | null
  }
  session: {
    id?: string
    createdAt: string | Date
  }
}

export interface AuthSessionProvider {
  api: {
    getSession: (args: { headers: Headers }) => Promise<AuthSession | null | undefined>
  }
}

export interface SessionActorBindings {
  Bindings?: {
    PLATFORM_BOOTSTRAP_EMAILS?: string
  }
  Variables: {
    actor: ActorMetadata | null
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
    accountKind?: 'human' | 'service'
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

function bootstrapEmailsFromEnv(env: { PLATFORM_BOOTSTRAP_EMAILS?: string } | undefined): string[] {
  return (env?.PLATFORM_BOOTSTRAP_EMAILS ?? '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)
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

function resolveAssuranceFromEmailVerified(
  emailVerified: boolean | undefined | null,
): ActorAssuranceLevel {
  return emailVerified === true
    ? ActorAssuranceLevel.Verified
    : ActorAssuranceLevel.Standard
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

  const emailVerified = input.user.emailVerified === true
  const email = typeof input.user.email === 'string' && input.user.email.trim() !== ''
    ? input.user.email.trim()
    : undefined

  return {
    user: {
      id: input.user.id,
      emailVerified,
      ...(email ? { email } : {}),
    },
    session: {
      ...(input.session.id ? { id: input.session.id } : {}),
      createdAt: authenticatedAt,
      assuranceLevel: resolveAssuranceFromEmailVerified(emailVerified),
    },
  }
}

async function resolvePlatformActor(
  repos: SchoolRepositories,
  user: { id: string, email?: string },
  context: {
    subjectId: string
    requestId: string
    sessionId?: string
    authenticatedAt: Date
    assuranceLevel: ActorAssuranceLevel
  },
  bootstrapEmails: readonly string[],
) {
  const existing = await repos.platformUsers.findBySubjectId(user.id)
  if (existing) {
    if (!existing.isActive) {
      return null
    }
    return createPlatformActorMetadata({
      ...context,
      actorId: existing.id,
      permissions: existing.permissions,
      email: existing.email,
    })
  }

  const email = user.email?.trim().toLowerCase()
  if (!email || !bootstrapEmails.includes(email)) {
    return null
  }

  const bootstrapped = await bootstrapPlatformUserIfAbsent(repos.platformUsers, {
    subjectId: user.id,
    email,
  })
  if (!bootstrapped) {
    return null
  }

  return createPlatformActorMetadata({
    ...context,
    actorId: bootstrapped.id,
    permissions: bootstrapped.permissions,
    email: bootstrapped.email,
  })
}

export function createSessionActorMiddleware(
  auth: AuthSessionProvider,
): MiddlewareHandler<SessionActorBindings> {
  return async (c, next) => {
    const authorization = c.req.header('authorization')
    const bearerApiKey = parseBearerApiKey(authorization)
    const bearerS2sKey = parseBearerS2sKey(authorization)
    const session = normalizeAuthSession(await auth.api.getSession({
      headers: c.req.raw.headers,
    }))

    if (session && (bearerApiKey || bearerS2sKey)) {
      c.set('actor', null)
      await next()
      return
    }

    const repos = c.var.schoolApp.repositories
    const requestId = c.req.header('x-request-id')?.trim() || randomUUID()
    const academicYearId = c.req.header('x-academic-year-id')?.trim() || undefined

    if (session) {
      const actorKind = parseInteractiveActorKind(c.req.header('x-actor-kind'))
      const interactiveContext = {
        subjectId: session.user.id,
        requestId,
        ...(session.session.id ? { sessionId: session.session.id } : {}),
        authenticatedAt: session.session.createdAt,
        assuranceLevel: session.session.assuranceLevel,
      }
      const bootstrapEmails = bootstrapEmailsFromEnv(c.env)

      if (actorKind === 'platform') {
        c.set('actor', await resolvePlatformActor(repos, session.user, interactiveContext, bootstrapEmails))
        await next()
        return
      }

      const identity = await resolveActorIdentity(
        repos,
        session.user.id,
        academicYearId,
        {
          actorKind,
          schoolId: c.req.header('x-school-id')?.trim() || undefined,
          actorId: c.req.header('x-actor-id')?.trim() || undefined,
        },
      )

      if (identity) {
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
        return
      }

      if (!actorKind && !(await subjectHasSchoolInteractiveIdentity(repos, session.user.id))) {
        c.set('actor', await resolvePlatformActor(repos, session.user, interactiveContext, bootstrapEmails))
        await next()
        return
      }

      c.set('actor', null)
      await next()
      return
    }

    if (bearerS2sKey) {
      const keyRecord = await repos.s2sClients.findActiveByHash(hashApiKey(bearerS2sKey))
      c.set('actor', keyRecord
        ? createS2sActorMetadata({
            actorId: keyRecord.id,
            schoolId: keyRecord.schoolId,
            requestId,
            clientId: keyRecord.clientId,
            accessClass: keyRecord.accessClass,
          })
        : null)
      await next()
      return
    }

    if (bearerApiKey) {
      const keyRecord = await repos.serviceApiKeys.findActiveByHash(hashApiKey(bearerApiKey))
      const staffMember = keyRecord
        ? await repos.staffMembers.findById(keyRecord.staffMemberId)
        : undefined
      if (!staffMember || staffMember.accountKind !== 'service' || !staffMember.isActive) {
        c.set('actor', null)
        await next()
        return
      }

      const effectiveGrants = await repos.authorization.resolveActorGrants({
        actorId: staffMember.id,
        actorType: 'staff',
        schoolId: staffMember.schoolId,
        ...(academicYearId ? { academicYearId } : {}),
      })
      c.set('actor', createServiceStaffActorMetadata({
        subjectId: `service:${staffMember.id}`,
        schoolId: staffMember.schoolId,
        requestId,
        authenticatedAt: new Date(),
        staffMemberId: staffMember.id,
        effectiveGrants,
      }))
      await next()
      return
    }

    c.set('actor', null)
    await next()
  }
}
