/**
 * Minimal Better Auth config for `@better-auth/cli generate` only.
 * Runtime wiring (secrets, baseURL) lives in `apps/api`.
 */
import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

const db = {} as never

export default betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  secret: 'cli-schema-generation-secret-32-chars-min',
  baseURL: 'http://localhost:9999',
  basePath: '/auth',
  emailAndPassword: {
    enabled: true,
  },
})
