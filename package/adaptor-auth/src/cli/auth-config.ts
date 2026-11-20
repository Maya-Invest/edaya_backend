/**
 * Better Auth config for `auth@1.7.3 generate` only.
 * Runtime wiring (secrets, baseURL) lives in `apps/api/src/identity`.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { jwt } from 'better-auth/plugins'

const db = {} as never

const options: Parameters<typeof betterAuth>[0] = {
  database: drizzleAdapter(db, {
    provider: 'pg',
    schemaName: 'auth',
  } as Parameters<typeof drizzleAdapter>[1]),
  secret: 'cli-schema-generation-secret-32-chars-min',
  baseURL: 'http://localhost:9999',
  basePath: '/auth',
  plugins: [jwt()],
  emailAndPassword: {
    enabled: true,
  },
}

const auth: ReturnType<typeof betterAuth> = betterAuth(options)
export default auth
