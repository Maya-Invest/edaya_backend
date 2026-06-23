import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { AuthSessionProvider, SessionActorBindings } from './session-actor-harness'
import {
  PostgresAtomicExecution,
  PostgresSchoolRepositories,
} from '@edaya/adaptor-postgres'
import { authSchema, runMigrations as runAuthMigrations } from '@edaya/betterauth-d1-migrations'
import {
  createRepositoryAuthorizationPolicy,
  noOpNotificationGateway,
  School,
  SchoolApplication,
  StaffMember,
} from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { Database } from 'bun:sqlite'
import { sql } from 'drizzle-orm'
import { drizzle as drizzleBunSqlite } from 'drizzle-orm/bun-sqlite'
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite'
import { Hono } from 'hono'
import {
  createSessionActorMiddleware,
} from './session-actor-harness'

export interface AuthTestEnv {
  BETTER_AUTH_SECRET: string
  BETTER_AUTH_URL: string
  LOG_LEVEL?: string
}

export const PG_LITE_AUTH_ENV: AuthTestEnv = {
  BETTER_AUTH_SECRET: 'super-secret-placeholder-key-for-local-testing',
  BETTER_AUTH_URL: 'http://localhost:9999',
  LOG_LEVEL: 'silent',
}

export interface AuthService {
  handler: (request: Request) => Promise<Response>
  api: AuthSessionProvider['api']
}

export type AuthDb = ReturnType<typeof drizzleBunSqlite>
export type SchoolDb = ReturnType<typeof drizzlePglite>

export interface AuthIntegrationContext {
  pglite: PGlite
  authSqlite: Database
  db: SchoolDb
  authDb: AuthDb
  repositories: PostgresSchoolRepositories
  application: SchoolApplication
  auth: AuthService
  env: AuthTestEnv
}

function createAuth(db: unknown, env: AuthTestEnv): AuthService {
  return betterAuth({
    database: drizzleAdapter(db as never, {
      provider: 'sqlite',
      schema: authSchema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    basePath: '/auth',
    emailAndPassword: {
      enabled: true,
    },
    ...(env.LOG_LEVEL === 'silent' ? { logger: { disabled: true } } : {}),
  }) as AuthService
}

export function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

export async function createAuthIntegrationContext(): Promise<AuthIntegrationContext> {
  const pglite = new PGlite()
  const db = drizzlePglite(pglite)
  const authSqlite = new Database(':memory:')
  const authDb = drizzleBunSqlite(authSqlite)
  const repositories = new PostgresSchoolRepositories(db)

  await runAuthMigrations(authDb, { driver: 'sqlite' })
  await repositories.init({ driver: 'pglite' })

  const application = new SchoolApplication({
    atomicExecution: new PostgresAtomicExecution(db as PostgresTransactionalDb),
    repositories,
    notificationGateway: noOpNotificationGateway,
    authorizationPolicy: createRepositoryAuthorizationPolicy({
      repositories,
      staffAssignmentRepository: repositories.staffAssignments,
      staffMemberRepository: repositories.staffMembers,
      guardianRepository: repositories.guardians,
      guardianStudentLinkRepository: repositories.guardianLinks,
      studentRepository: repositories.students,
    }),
  })

  const auth = createAuth(authDb, PG_LITE_AUTH_ENV)

  return {
    pglite,
    authSqlite,
    db,
    authDb,
    repositories,
    application,
    auth,
    env: PG_LITE_AUTH_ENV,
  }
}

export async function ensureAuthUser(
  auth: AuthService,
  env: AuthTestEnv,
  authDb: AuthDb,
  account: { email: string, password: string, name: string },
): Promise<string> {
  const signInResponse = await auth.handler(new Request(`${env.BETTER_AUTH_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
    }),
  }))

  if (signInResponse.ok) {
    const signInBody = await signInResponse.json() as { user?: { id?: string } }
    if (signInBody.user?.id) {
      return signInBody.user.id
    }
  }

  const signUpResponse = await auth.handler(new Request(`${env.BETTER_AUTH_URL}/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(account),
  }))

  if (!signUpResponse.ok) {
    const message = await signUpResponse.text()
    throw new Error(`Failed to provision auth user ${account.email}: ${signUpResponse.status} ${message}`)
  }

  const signUpBody = await signUpResponse.json() as { user?: { id?: string } }
  const userId = signUpBody.user?.id ?? (await findUserByEmail(authDb, account.email))?.id
  if (!userId) {
    throw new Error(`Better Auth sign-up for ${account.email} did not return a user id`)
  }

  return userId
}

export async function linkStaffMemberToAuthUser(
  application: SchoolApplication,
  staffMemberId: string,
  subjectId: string,
): Promise<void> {
  const staff = await application.repositories.staffMembers.findById(staffMemberId)
  if (!staff) {
    throw new Error(`Staff member ${staffMemberId} not found`)
  }

  await application.repositories.staffMembers.save(new StaffMember({
    id: staff.id,
    schoolId: staff.schoolId,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    isActive: staff.isActive,
    createdAt: staff.createdAt,
    subjectId,
  }))

  const school = await application.repositories.schools.findById(staff.schoolId)
  if (school && !school.ownerSubjectId) {
    await application.repositories.schools.save(new School({
      id: school.id,
      name: school.name,
      timeZone: school.timeZone,
      ownerSubjectId: subjectId,
      type: school.type,
      country: school.country,
      city: school.city,
      createdAt: school.createdAt,
    }))
  }
}

export async function signUpEmail(
  auth: AuthService,
  env: AuthTestEnv,
  input: { email: string, password: string, name: string },
): Promise<Response> {
  return auth.handler(new Request(`${env.BETTER_AUTH_URL}/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  }))
}

export async function signInEmail(
  auth: AuthService,
  env: AuthTestEnv,
  input: { email: string, password: string },
): Promise<Response> {
  return auth.handler(new Request(`${env.BETTER_AUTH_URL}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  }))
}

export function createSessionActorApp(
  application: SchoolApplication,
  auth: AuthService,
) {
  const app = new Hono<SessionActorBindings>()
  app.use(async (c, next) => {
    c.set('schoolApp', { repositories: application.repositories })
    await next()
  })
  app.use(createSessionActorMiddleware(auth))
  return app
}

export function mountEffectiveGrantsRoute(app: ReturnType<typeof createSessionActorApp>): void {
  app.get('/core/authorization/effective-grants', (c) => {
    const actor = c.get('actor')
    if (!actor) {
      return c.json({ message: 'Missing or invalid authorization session' }, 401)
    }
    return c.json({
      kind: actor.kind,
      actorId: actor.actorId,
      schoolId: actor.schoolId,
    }, 200)
  })
}

export async function countAuthTableRows(
  authDb: AuthDb,
  table: 'user' | 'account' | 'session',
): Promise<number> {
  const rows = await authDb.all<{ count: number }>(sql.raw(`SELECT COUNT(*) AS count FROM "${table}"`))
  return rows[0]?.count ?? 0
}

export async function findUserByEmail(
  authDb: AuthDb,
  email: string,
): Promise<{ id: string, email: string } | null> {
  const rows = await authDb.all<{ id: string, email: string }>(
    sql`SELECT id, email FROM "user" WHERE email = ${email}`,
  )
  return rows[0] ?? null
}

export async function countAccountRowsForUser(authDb: AuthDb, userId: string): Promise<number> {
  const rows = await authDb.all<{ count: number }>(
    sql`SELECT COUNT(*) AS count FROM "account" WHERE user_id = ${userId}`,
  )
  return rows[0]?.count ?? 0
}

export async function closeAuthIntegrationContext(context: AuthIntegrationContext): Promise<void> {
  context.authSqlite.close()
  await context.pglite.close()
}
