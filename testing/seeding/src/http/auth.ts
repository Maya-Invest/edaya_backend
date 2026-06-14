import type { AuthAccountInput, AuthProvisioner } from '../types'
import type { HttpSeedClient } from './client'

interface AuthUserResponse {
  user?: {
    id?: string
  }
}

async function readAuthUserId(response: Response): Promise<string | undefined> {
  const bodyText = await response.text()
  if (!bodyText.trim()) {
    return undefined
  }

  const body = JSON.parse(bodyText) as AuthUserResponse
  return body.user?.id
}

export class HttpAuthProvisioner implements AuthProvisioner {
  constructor(private readonly client: HttpSeedClient) {}

  async ensureUser(account: AuthAccountInput): Promise<{ subjectId: string }> {
    const subjectId = await this.signIn(account)
    if (subjectId) {
      return { subjectId }
    }

    const signedUpSubjectId = await this.signUp(account)
    if (!signedUpSubjectId) {
      throw new Error(`Better Auth sign-up for ${account.email} did not return a user id`)
    }

    return { subjectId: signedUpSubjectId }
  }

  async lookupSubjectIdByEmail(email: string, password: string): Promise<string | undefined> {
    return this.signIn({ email, password, name: email })
  }

  private async signIn(account: AuthAccountInput): Promise<string | undefined> {
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
      return undefined
    }

    return readAuthUserId(response)
  }

  private async signUp(account: AuthAccountInput): Promise<string | undefined> {
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
      throw new Error(`Failed to provision dev auth user ${account.email}: ${response.status} ${message}`)
    }

    return readAuthUserId(response)
  }
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
