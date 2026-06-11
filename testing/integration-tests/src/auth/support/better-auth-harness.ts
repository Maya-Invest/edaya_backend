import type { PostgresTransactionalDb } from '@edaya/adaptor-postgres'
import type { AuthSessionProvider, SessionActorBindings } from './session-actor-harness'
import { authSchema, runMigrations as runAuthMigrations } from '@edaya/adaptor-betterauth'
import {
  PostgresAtomicExecution,
  PostgresSchoolRepositories,

} from '@edaya/adaptor-postgres'
import {
  createRepositoryAuthorizationPolicy,
  SchoolApplication,
  StaffMember,
} from '@edaya/core'
import { PGlite } from '@electric-sql/pglite'
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'
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

export interface AuthIntegrationContext {
  pglite: PGlite
  db: ReturnType<typeof drizzle>
  repositories: PostgresSchoolRepositories
  application: SchoolApplication
  auth: AuthService
  env: AuthTestEnv
}

function createAuth(db: unknown, env: AuthTestEnv): AuthService {
  return betterAuth({
    database: drizzleAdapter(db as never, {
      provider: 'pg',
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
  const db = drizzle(pglite)
  const repositories = new PostgresSchoolRepositories(db)

  await runAuthMigrations(db, { driver: 'pglite' })
  await repositories.init({ driver: 'pglite' })

  const application = new SchoolApplication({
    atomicExecution: new PostgresAtomicExecution(db as PostgresTransactionalDb),
    repositories,
    authorizationPolicy: createRepositoryAuthorizationPolicy({
      repositories,
      staffAssignmentRepository: repositories.staffAssignments,
      staffMemberRepository: repositories.staffMembers,
      guardianRepository: repositories.guardians,
      guardianStudentLinkRepository: repositories.guardianLinks,
      studentRepository: repositories.students,
    }),
  })

  const auth = createAuth(db, PG_LITE_AUTH_ENV)

  return {
    pglite,
    db,
    repositories,
    application,
    auth,
    env: PG_LITE_AUTH_ENV,
  }
}

export async function ensureAuthUser(
  auth: AuthService,
  env: AuthTestEnv,
  db: ReturnType<typeof drizzle>,
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
  const userId = signUpBody.user?.id ?? (await findUserByEmail(db, account.email))?.id
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
  db: ReturnType<typeof drizzle>,
  table: 'user' | 'account' | 'session',
): Promise<number> {
  const result = await db.execute(sql.raw(`SELECT COUNT(*)::int AS count FROM "${table}"`))
  const [row] = result.rows as Array<{ count: number }>
  return row?.count ?? 0
}

export async function findUserByEmail(
  db: ReturnType<typeof drizzle>,
  email: string,
): Promise<{ id: string, email: string } | null> {
  const result = await db.execute(
    sql`SELECT id, email FROM "user" WHERE email = ${email}`,
  )
  const [row] = result.rows as Array<{ id: string, email: string }>
  return row ?? null
}

export async function countAccountRowsForUser(db: ReturnType<typeof drizzle>, userId: string): Promise<number> {
  const result = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM "account" WHERE user_id = ${userId}`,
  )
  const [row] = result.rows as Array<{ count: number }>
  return row?.count ?? 0
}
