import type { AuthAccountInput, AuthProvisioner, EnsureUserOptions } from '../../support/types'
import type { HttpSeedClient } from '../../transport/http/client'
import { isTransientHttpStatus } from '../../transport/http/client'
import { repairStagingAuthUser, shouldRepairStaleStagingAuthUsers } from './staging-user-repair'

interface AuthUserResponse {
  user?: {
    id?: string
  }
}

interface AuthAttemptResult {
  subjectId?: string
  status: number
  code?: string
}

const MAX_ENSURE_USER_ATTEMPTS = 4
const TRANSIENT_RETRY_DELAY_MS = 1500

async function readAuthUserId(response: Response): Promise<string | undefined> {
  const bodyText = await response.text()
  if (!bodyText.trim()) {
    return undefined
  }

  const body = JSON.parse(bodyText) as AuthUserResponse
  return body.user?.id
}

function readAuthErrorCode(message: string): string | undefined {
  try {
    const body = JSON.parse(message) as { code?: string }
    return body.code
  }
  catch {
    return undefined
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export class HttpAuthProvisioner implements AuthProvisioner {
  constructor(private readonly client: HttpSeedClient) {}

  async ensureUser(account: AuthAccountInput, options?: EnsureUserOptions): Promise<{ subjectId: string }> {
    if (options?.preserveSession) {
      return this.client.withCookieSnapshot(() => this.ensureUser(account))
    }

    const attempts: string[] = []

    for (let round = 0; round < MAX_ENSURE_USER_ATTEMPTS; round++) {
      const signInResult = await this.signIn(account)
      if (signInResult.subjectId) {
        return { subjectId: signInResult.subjectId }
      }

      if (isTransientHttpStatus(signInResult.status)) {
        attempts.push(formatSignInFailure(signInResult))
        await sleep(TRANSIENT_RETRY_DELAY_MS * (round + 1))
        continue
      }

      attempts.push(formatSignInFailure(signInResult))

      let signUpResult = await this.signUp(account, attempts)
      if (!signUpResult.subjectId && this.shouldRepairStaleUser(signInResult, signUpResult, attempts)) {
        await repairStagingAuthUser(account.email)
        attempts.push('repaired stale staging auth user')
        signUpResult = await this.signUp(account, attempts)
      }

      if (signUpResult.subjectId) {
        return { subjectId: signUpResult.subjectId }
      }

      if (isTransientHttpStatus(signUpResult.status)) {
        await sleep(TRANSIENT_RETRY_DELAY_MS * (round + 1))
        continue
      }

      const retryResult = await this.signIn(account)
      if (retryResult.subjectId) {
        return { subjectId: retryResult.subjectId }
      }

      if (isTransientHttpStatus(retryResult.status)) {
        attempts.push(`retry ${formatSignInFailure(retryResult)}`)
        await sleep(TRANSIENT_RETRY_DELAY_MS * (round + 1))
        continue
      }

      attempts.push(`retry ${formatSignInFailure(retryResult)}`)
      break
    }

    throw new Error(
      `Better Auth could not provision or sign in ${account.email} (${attempts.join('; ')})`,
    )
  }

  private shouldRepairStaleUser(
    signInResult: AuthAttemptResult,
    signUpResult: AuthAttemptResult,
    attempts: string[],
  ): boolean {
    if (!shouldRepairStaleStagingAuthUsers(this.client.origin)) {
      return false
    }

    const userAlreadyExists = signUpResult.code === 'USER_ALREADY_EXISTS'
      || attempts.some(entry => entry.includes('user already exists'))
    const invalidCredentials = signInResult.status === 401
      && signInResult.code === 'INVALID_EMAIL_OR_PASSWORD'

    return userAlreadyExists && invalidCredentials
  }

  async lookupSubjectIdByEmail(email: string, password: string): Promise<string | undefined> {
    const result = await this.signIn({ email, password, name: email })
    return result.subjectId
  }

  private async signIn(account: AuthAccountInput): Promise<AuthAttemptResult> {
    const response = await this.client.request('/auth/sign-in/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      return {
        status: response.status,
        code: readAuthErrorCode(message),
      }
    }

    const subjectId = await readAuthUserId(response)
    return {
      status: response.status,
      ...(subjectId ? { subjectId } : {}),
    }
  }

  private async signUp(
    account: AuthAccountInput,
    attempts: string[],
  ): Promise<AuthAttemptResult> {
    const response = await this.client.request('/auth/sign-up/email', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        email: account.email,
        password: account.password,
        name: account.name,
      }),
    })

    if (!response.ok) {
      const message = await response.text()
      if (response.status === 422 && isUserAlreadyExistsMessage(message)) {
        attempts.push('sign-up skipped (user already exists)')
        return { status: response.status, code: 'USER_ALREADY_EXISTS' }
      }

      attempts.push(`sign-up ${response.status}${readAuthErrorCode(message) ? ` ${readAuthErrorCode(message)}` : ''}`)
      return {
        status: response.status,
        code: readAuthErrorCode(message),
      }
    }

    const subjectId = await readAuthUserId(response)
    return {
      status: response.status,
      ...(subjectId ? { subjectId } : {}),
    }
  }
}

function isUserAlreadyExistsMessage(message: string): boolean {
  return message.includes('USER_ALREADY_EXISTS')
    || message.includes('User already exists')
}

function formatSignInFailure(result: AuthAttemptResult): string {
  if (result.code) {
    return `sign-in ${result.status} ${result.code}`
  }

  return `sign-in ${result.status}`
}

export async function signInViaHttp(
  client: HttpSeedClient,
  input: { email: string, password: string },
): Promise<void> {
  const response = await client.request('/auth/sign-in/email', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    const message = await response.text()
    throw new Error(`Sign-in failed for ${input.email}: ${response.status} ${message}`)
  }
}
