import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { environment, gitEnvironment, root, run, sha, writeJson } from './runtime'
import { tool } from './tools'

async function github(path: string): Promise<unknown> {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/${path}`, { headers: { Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(30000) })
  if (!response.ok)
    throw new Error('Could not read deployment history')
  return response.json()
}
export async function compatibility(target: string): Promise<void> {
  environment(target)
  let ref = process.env.COMPATIBILITY_BASE_SHA
  if (!ref && process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY)
    ref = await lastSuccessfulDeployment(target, github)
  const directory = resolve(root, '.release')
  mkdirSync(directory, { recursive: true })
  const baseline = resolve(directory, 'baseline.json')
  if (ref) {
    sha(ref)
    await run(['git', 'fetch', 'origin', ref], { quiet: true, env: gitEnvironment() })
    writeFileSync(baseline, await run(['git', 'show', `${ref}:tooling/repo/fixtures/openapi.json`], { quiet: true }))
  }
  else {
    const initial = resolve(root, 'tooling/repo/fixtures/compatibility/bootstrap.json')
    if (!existsSync(initial))
      throw new Error('Missing reviewed compatibility baseline')
    writeFileSync(baseline, readFileSync(initial))
  }
  await checkContract(baseline, resolve(root, 'tooling/repo/fixtures/openapi.json'), resolve(root, '.ci-evidence/contract-changes.json'))
}

/** Clients upgrade with the backend; historical wire changes are release information. */
export async function checkContract(baseline: string, current: string, report: string, execute: typeof run = run): Promise<void> {
  rmSync(report, { force: true })
  // Omitting --fail-on permits reported changes, but tool/spec failures still reject.
  const changes: unknown = JSON.parse(await execute([await tool('oasdiff'), 'breaking', baseline, current, '--format', 'json'], { quiet: true }))
  if (!Array.isArray(changes))
    throw new Error('Invalid contract change report')
  writeJson(report, { policy: 'clients-upgrade-with-backend', blocking: false, changes })
  process.stdout.write(`Historical API comparison: ${changes.length} client upgrade changes (informational).\n`)
  await execute(['bun', 'test', 'src/compatibility', '--parallel=1'], { cwd: resolve(root, 'tooling/integration-tests') })
}

/** Failed recent releases must never make an older successful baseline disappear. */
export async function lastSuccessfulDeployment(target: string, request: (path: string) => Promise<unknown>): Promise<string | undefined> {
  environment(target)
  for (let page = 1; ; page++) {
    const deployments = await request(`deployments?task=edaya-release&environment=${target}&per_page=100&page=${page}`) as { id: number, sha: string }[]
    for (const deployment of deployments) {
      const statuses = await request(`deployments/${deployment.id}/statuses?per_page=1`) as { state: string }[]
      if (statuses[0]?.state === 'success')
        return sha(deployment.sha)
    }
    if (deployments.length < 100)
      return undefined
  }
}
