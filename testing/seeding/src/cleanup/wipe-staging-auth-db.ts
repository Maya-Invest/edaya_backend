import { spawnSync } from 'node:child_process'
import path from 'node:path'

const STAGING_AUTH_D1 = 'edaya-auth-staging'

const WIPE_AUTH_SQL = [
  'DELETE FROM session;',
  'DELETE FROM account;',
  'DELETE FROM verification;',
  'DELETE FROM user;',
].join(' ')

export function wipeStagingAuthDatabase(repoRoot: string): void {
  const apiDir = path.join(repoRoot, 'apps/api')
  const result = spawnSync('bunx', [
    'wrangler',
    'd1',
    'execute',
    STAGING_AUTH_D1,
    '--env',
    'staging',
    '--remote',
    '--command',
    WIPE_AUTH_SQL,
  ], {
    cwd: apiDir,
    stdio: ['inherit', 'pipe', 'pipe'],
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.toString().trim()
    throw new Error(
      `Failed to wipe staging Better Auth D1 (${STAGING_AUTH_D1}): ${stderr || `wrangler exited ${result.status ?? 1}`}`,
    )
  }
}
