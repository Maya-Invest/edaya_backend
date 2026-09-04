import { DEV_AUTH_PASSWORD } from '@edaya/fixtures/demo-login'
import { afterEach, describe, expect, it } from 'bun:test'
import {
  getLastAuthVerificationUrlForTests,
  resetAuthOtpMailerForTests,
} from '@/runtime/shared/adapters/auth-otp-mailer'
import {
  closeAuthIntegrationContext,
  collectSetCookieHeaders,
  createAuthIntegrationContext,
  findUserByEmail,
  signInEmail,
  signUpEmail,
} from './support/better-auth-harness'

const WEBAPP_ORIGIN = 'http://localhost:5173'
const LOGIN_CALLBACK = `${WEBAPP_ORIGIN}/login?verified=1`

function assertLoginRedirect(location: string | null): void {
  expect(location).toBeTruthy()
  const redirected = new URL(location as string, WEBAPP_ORIGIN)
  expect(redirected.origin).toBe(WEBAPP_ORIGIN)
  expect(redirected.pathname).toBe('/login')
  expect(redirected.searchParams.get('verified')).toBe('1')
}

describe('email verification login redirect', () => {
  const contexts: Array<Awaited<ReturnType<typeof createAuthIntegrationContext>>> = []

  afterEach(async () => {
    resetAuthOtpMailerForTests()
    while (contexts.length > 0) {
      const context = contexts.pop()
      if (context) {
        await closeAuthIntegrationContext(context)
      }
    }
  })

  it('provisions an unverified account, then redirects verify-email to the webapp login page', async () => {
    const context = await createAuthIntegrationContext({
      REQUIRE_EMAIL_VERIFICATION: true,
      WEBAPP_ORIGIN,
      TRUSTED_ORIGINS: WEBAPP_ORIGIN,
    })
    contexts.push(context)

    const { auth, authDb, env } = context
    const email = 'owner.verify@school.edu'

    const signUpResponse = await signUpEmail(auth, env, {
      email,
      password: DEV_AUTH_PASSWORD,
      name: 'Verify Owner',
    })
    expect(signUpResponse.status).toBe(200)
    expect(collectSetCookieHeaders(signUpResponse)).toHaveLength(0)

    const beforeVerify = await findUserByEmail(authDb, email)
    expect(beforeVerify?.emailVerified).toBe(false)

    const blockedSignIn = await signInEmail(auth, env, {
      email,
      password: DEV_AUTH_PASSWORD,
    })
    expect(blockedSignIn.ok).toBe(false)

    const verifyUrl = getLastAuthVerificationUrlForTests(email)
    expect(verifyUrl).toBeDefined()
    expect(new URL(verifyUrl as string).searchParams.get('callbackURL')).toBe(LOGIN_CALLBACK)

    const verifyResponse = await Promise.race([
      auth.handler(new Request(verifyUrl as string)),
      new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('verify-email handler timed out')), 8_000)
      }),
    ])
    expect(verifyResponse.status).toBeGreaterThanOrEqual(300)
    expect(verifyResponse.status).toBeLessThan(400)
    assertLoginRedirect(verifyResponse.headers.get('location'))

    const afterVerify = await findUserByEmail(authDb, email)
    expect(afterVerify?.emailVerified).toBe(true)

    const signInResponse = await signInEmail(auth, env, {
      email,
      password: DEV_AUTH_PASSWORD,
    })
    expect(signInResponse.status).toBe(200)
    expect(collectSetCookieHeaders(signInResponse).length).toBeGreaterThan(0)
  }, 60_000)
})
