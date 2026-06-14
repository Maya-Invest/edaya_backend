import type { AuthAccountInput, AuthProvisioner } from '../types'

interface AuthUserResponse {
  user?: {
    id?: string
  }
}

export interface AuthHandler {
  handler: (request: Request) => Promise<Response>
  api: {
    getSession: (args: { headers: Headers }) => Promise<unknown>
  }
}

function collectSetCookieHeaders(response: Response): string[] {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] }
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie()
  }

  const single = response.headers.get('set-cookie')
  return single ? [single] : []
}

async function readAuthUserId(response: Response): Promise<string | undefined> {
  const bodyText = await response.text()
  if (!bodyText.trim()) {
    return undefined
  }

  const body = JSON.parse(bodyText) as AuthUserResponse
  return body.user?.id
}

async function readSessionUserId(
  auth: AuthHandler,
  response: Response,
): Promise<string | undefined> {
  const userId = await readAuthUserId(response)
  if (userId) {
    return userId
  }

  const cookies = collectSetCookieHeaders(response)
  if (cookies.length === 0) {
    return undefined
  }

  const session = await auth.api.getSession({
    headers: new Headers({ cookie: cookies.join('; ') }),
  }) as AuthUserResponse | null

  return session?.user?.id
}

async function lookupAuthUserIdByEmail(
  auth: AuthHandler,
  baseUrl: string,
  email: string,
  password: string,
): Promise<string | undefined> {
  const signInResponse = await auth.handler(new Request(`${baseUrl}/auth/sign-in/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
    }),
  }))

  if (!signInResponse.ok) {
    return undefined
  }

  return readSessionUserId(auth, signInResponse)
}

async function ensureAuthUser(
  auth: AuthHandler,
  baseUrl: string,
  account: AuthAccountInput,
): Promise<string> {
  const signInResponse = await auth.handler(new Request(`${baseUrl}/auth/sign-in/email`, {
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
    const userId = await readSessionUserId(auth, signInResponse)
    if (userId) {
      return userId
    }
  }

  const signUpResponse = await auth.handler(new Request(`${baseUrl}/auth/sign-up/email`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      email: account.email,
      password: account.password,
      name: account.name,
    }),
  }))

  if (!signUpResponse.ok) {
    const message = await signUpResponse.text()
    throw new Error(`Failed to provision dev auth user ${account.email}: ${signUpResponse.status} ${message}`)
  }

  const userId = await readSessionUserId(auth, signUpResponse)
  if (!userId) {
    throw new Error(`Better Auth sign-up for ${account.email} did not return a user id`)
  }

  return userId
}

/** Provision auth users through an in-process Better Auth handler (tests and local tooling). */
export function createHandlerAuthProvisioner(auth: AuthHandler, baseUrl: string): AuthProvisioner {
  return {
    ensureUser: async account => ({
      subjectId: await ensureAuthUser(auth, baseUrl, account),
    }),
    lookupSubjectIdByEmail: (email, password) => lookupAuthUserIdByEmail(auth, baseUrl, email, password),
  }
}
