import { parseEnv } from '../../../../apps/identity/src/env'
import { createTestingIdentity } from '../../../../apps/identity/testing/composition'

/** Disposable real identity service owned by the native test runner, never a project database. */
export async function startTestIdentity() {
  let fetchIdentity: (request: Request) => Response | Promise<Response> = () => new Response(null, { status: 503 })
  const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: request => fetchIdentity(request) })
  const origin = `http://127.0.0.1:${server.port}`
  try {
    const env = parseEnv({
      NODE_ENV: 'test',
      AUTH_DATABASE_URL: 'pglite',
      BETTER_AUTH_SECRET: 'seed-test-only-identity-secret-32-characters',
      BETTER_AUTH_URL: origin,
      FIRST_PARTY_API_ORIGINS: 'http://localhost:9999',
      IDENTITY_DIRECTORY_SECRET: 'test-directory-secret',
      EMAIL_TRANSPORT: 'log',
      LOG_LEVEL: 'silent',
    }, 'test')
    const test = await createTestingIdentity(env)
    fetchIdentity = request => test.app.fetch(request, env)
    return { origin, async close() {
      server.stop(true)
      await test.close()
    } }
  }
  catch (error) {
    server.stop(true)
    throw error
  }
}
