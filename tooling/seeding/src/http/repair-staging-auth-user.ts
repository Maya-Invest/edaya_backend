/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

function escapeSqlString(value: string): string {
  return value.replaceAll('\'', '\'\'')
}

export function isStagingSeedApiUrl(baseUrl: string): boolean {
  return baseUrl.includes('api-staging.')
}

export function shouldRepairStaleStagingAuthUsers(baseUrl: string): boolean {
  if (!isStagingSeedApiUrl(baseUrl)) {
    return false
  }

  const flag = process.env['SEED_AUTH_REPAIR_STALE']?.trim().toLowerCase()
  return flag !== 'false' && flag !== '0' && flag !== 'no'
}

/** Remove a broken Better Auth user from staging D1 so sign-up can recreate it. */
export function repairStagingAuthUser(email: string): void {
  const command = `DELETE FROM user WHERE email = '${escapeSqlString(email)}';`
  const result = Bun.spawnSync([
    'bunx',
    'wrangler',
    'd1',
    'execute',
    'edaya-auth-staging',
    '--env',
    'staging',
    '--remote',
    '--command',
    command,
  ], {
    cwd: path.join(repoRoot, 'apps/api'),
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim()
    throw new Error(
      `Failed to repair stale staging auth user ${email}: ${stderr || `wrangler exited ${result.exitCode}`}`,
    )
  }
}
