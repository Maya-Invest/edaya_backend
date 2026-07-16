import { buildDevDemoLoginAccounts } from '@edaya/fixtures/demo-login'
import { resolveDevSeedContext } from '@edaya/fixtures/meta/resolve-dev-seed-context'
import { signInViaHttp } from '../bootstrap/auth/http-provisioner'
import { HttpSeedClient } from '../transport/http/client'

export async function runHttpVerifyDemoStaffGrants(
  baseUrl: string,
  appOrigin: string,
): Promise<{ status: 'passed' | 'failed', failures: string[] }> {
  const context = resolveDevSeedContext()
  const failures: string[] = []

  for (const account of buildDevDemoLoginAccounts()) {
    const client = new HttpSeedClient({ baseUrl, appOrigin })
    await signInViaHttp(client, {
      email: account.email,
      password: context.authPassword,
    })
    const grants = await client.jsonRequest('/core/authorization/effective-grants')
    if (!grants.response.ok) {
      failures.push(`${account.email} (${grants.response.status})`)
    }
  }

  return failures.length === 0
    ? { status: 'passed', failures }
    : { status: 'failed', failures }
}
