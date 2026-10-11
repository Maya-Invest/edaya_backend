#!/usr/bin/env bun
import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { commandDocs } from './command-docs'
import { buildRelease, deployRelease, qualifyRelease, validateRelease } from './release'
import { assertCommittedSource, environment, githubOutput, redact, root, run, sha, writeJson } from './runtime'
import { tool } from './tools'

const commands = {
  check: 'Repository hygiene, workflow lint, generated contract checks and type checks.',
  test: 'unit | integration | tooling',
  build: 'staging | production (build immutable release artifacts without deployment)',
  generate: 'openapi | openapi-export | codegen | templates | commands',
  dev: 'Start local API and file services.',
  maintenance: 'db | seed | vars | secrets | pause | resume | status | smoke | reset-staging | emergency-deploy',
  ci: 'verify | qualify | fixture | migrate | deploy | resolve | workflows',
}
export function help(): string {
  return `Usage: bun run repo <command>\n\n${Object.entries(commands).map(([name, description]) => `${name.padEnd(14)}${description}`).join('\n')}\n`
}
export async function main(args: string[]): Promise<void> {
  if (!args.length || args.includes('--help') || args.includes('-h')) {
    console.log(help())
    return
  }
  const [group, name, ...rest] = args
  if (group === 'ci') {
    if (['verify', 'workflows', 'setup', 'resolve', 'archive-inputs', 'maintenance', 'browser-suites'].includes(name ?? '') && rest.length)
      throw new Error('Unexpected CI arguments')
    if (['qualify', 'migrate'].includes(name ?? '') && rest.length !== 1)
      throw new Error('Expected exactly one environment')
    if (name === 'deploy' && (rest.length < 1 || rest.length > 2 || (rest.length === 2 && rest[1] !== '--dry-run')))
      throw new Error('Expected deploy environment [--dry-run]')
  }
  const script = (path: string, forward: string[] = []) => run(['bun', '--no-env-file', path, ...forward])
  if (group === 'check') {
    if (name)
      throw new Error('check accepts no arguments')
    commandDocs(help())
    for (const file of ['ci/doctor.ts', 'openapi/check-drift.ts', 'ci/check-boundaries.ts', 'ci/check-test-naming.ts'])
      await script(`tooling/repo/${file}`)
    return
  }
  if (group === 'dev' && !name) {
    await run(['bun', '--no-env-file', 'tooling/repo/dev/start-local-dev.ts'], { timeout: 0 })
    return
  }
  if (group === 'generate') {
    if (name === 'templates' && !rest.length) {
      await run(['bun', 'scripts/precompile-templates.ts'], { cwd: resolve(root, 'package/adaptor-docs') })
      return
    }
    if (name === 'codegen') {
      await script('tooling/repo/codegen/bin/edaya-codegen.ts', rest)
      return
    }
    if (name === 'openapi-export') {
      await script('tooling/repo/openapi/export.ts', rest)
      return
    }
    if (name === 'openapi' && !rest.length) {
      await script('tooling/repo/openapi/update.ts')
      return
    }
    if (name === 'commands' && !rest.length) {
      const { writeFileSync } = await import('node:fs')
      writeFileSync(resolve(root, 'tooling/repo/ops/commands.txt'), help())
      commandDocs(help(), true)
      return
    }
  }
  if (group === 'test' && !rest.length) {
    if (name === 'tooling') {
      await run(['bun', 'test', './tooling/repo/ops/tests'])
      return
    }
    if (name === 'unit') {
      await run(['bun', 'run', 'test'], { timeout: 120 * 60000 })
      return
    }
    if (name === 'integration') {
      for (const task of ['test:integration', 'test:integration:seed', 'test:integration:native'])
        await run(['bun', 'run', task], { timeout: 60 * 60000 })
      return
    }
  }
  if (group === 'build' && !rest.length) {
    await buildRelease(environment(name))
    return
  }
  if (group === 'maintenance' && name) {
    if (name === 'reset-staging') {
      const { maintenance } = await import('./maintenance')
      await maintenance(rest)
      return
    }
    if (name === 'emergency-deploy') {
      const target = environment(rest[0])
      const dry = rest.includes('--dry-run')
      if (!dry && !rest.includes('--yes'))
        throw new Error('Emergency deployment requires --yes after reviewing its environment')
      if (rest.some((value, index) => index > 0 && !['--yes', '--dry-run'].includes(value)))
        throw new Error('Unexpected emergency-deploy argument')
      if (!dry)
        await assertCommittedSource()
      await buildRelease(target)
      if (!dry) {
        const record = JSON.parse(readFileSync(resolve(root, '.release/manifest.json'), 'utf8'))
        record.status = 'qualified'
        record.emergency = true
        writeJson(resolve(root, '.release/manifest.json'), record)
      }
      const { recordDeployment } = await import('./github')
      if (dry)
        await deployRelease(target, true)
      else
        await recordDeployment(target, () => deployRelease(target))
      return
    }
    if (['db', 'seed', 'vars', 'secrets', 'pause', 'resume', 'status', 'smoke'].includes(name)) {
      const { dispatchCompoundCommand } = await import('../cli/dispatch')
      const { config } = await import('dotenv')
      config({ path: resolve(root, '.env') })
      const code = await dispatchCompoundCommand(name as 'db' | 'seed' | 'vars' | 'secrets' | 'pause' | 'resume' | 'status' | 'smoke', rest)
      if (code)
        throw new Error(`Maintenance ${name} failed`)
      return
    }
  }
  if (group === 'ci') {
    if (name === 'maintenance') {
      const dry = process.env.MAINTENANCE_DRY_RUN
      if (!['true', 'false'].includes(dry ?? '') || !['reset-reseed', 'recover'].includes(process.env.MAINTENANCE_OPERATION ?? ''))
        throw new Error('Invalid maintenance workflow inputs')
      if (dry === 'false' && process.env.MAINTENANCE_CONFIRMATION !== 'STAGING MAINTENANCE')
        throw new Error('Explicit staging maintenance confirmation is required')
      await main(['maintenance', 'reset-staging', 'staging', dry === 'true' ? '--dry-run' : '--yes', ...(process.env.MAINTENANCE_OPERATION === 'recover' ? ['--recover'] : [])])
      return
    }
    if (name === 'workflows') {
      await run([await tool('actionlint'), '-shellcheck=', ...Array.from(new Bun.Glob('.github/workflows/*.yml').scanSync({ cwd: root }))])
      return
    }
    if (name === 'verify') {
      await main(['check'])
      await main(['ci', 'workflows'])
      await main(['test', 'tooling'])
      await run(['bun', 'run', 'quality'])
      await run(['bun', 'run', 'build'])
      await main(['test', 'unit'])
      return
    }
    if (name === 'fixture') {
      const [cwd, separator, ...command] = rest
      if (!cwd || separator !== '--')
        throw new Error('Expected fixture cwd -- command')
      const { fixture } = await import('./fixture')
      await fixture(command, resolve(cwd))
      return
    }
    if (name === 'migrate') {
      const target = environment(rest[0])
      await assertCommittedSource()
      const record = await validateRelease(target)
      if (record.status !== 'qualified' || !['verification', 'integration', 'compatibility'].every(check => record.tests.includes(check)))
        throw new Error('Migrations require the fully qualified deployment artifacts')
      await main(['maintenance', 'db', 'migrate', 'identity', target])
      await main(['maintenance', 'db', 'migrate', 'school', target])
      return
    }
    if (name === 'archive-inputs') {
      const { cpSync, mkdirSync } = await import('node:fs')
      mkdirSync(resolve(root, '.release'), { recursive: true })
      cpSync(resolve(root, 'bun.lock'), resolve(root, '.release/bun.lock'))
      return
    }
    if (name === 'setup') {
      const path = await run(['pg_config', '--bindir'], { quiet: true })
      if (process.env.GITHUB_PATH) {
        const { appendFileSync } = await import('node:fs')
        appendFileSync(process.env.GITHUB_PATH, `${path}\n`)
      }
      return
    }
    if (name === 'deploy') {
      const { recordDeployment } = await import('./github')
      if (rest.includes('--dry-run'))
        await deployRelease(environment(rest[0]), true)
      else
        await recordDeployment(environment(rest[0]), () => deployRelease(environment(rest[0])))
      return
    }
    if (name === 'qualify') {
      const target = environment(rest[0])
      mkdirSync(resolve(root, '.ci-evidence'), { recursive: true })
      const evidence = { sourceCommit: sha(await run(['git', 'rev-parse', 'HEAD'], { quiet: true })), environment: target, checks: { verification: false, integration: false, compatibility: false } }
      writeJson(resolve(root, '.ci-evidence/qualification.json'), evidence)
      try {
        await main(['ci', 'verify'])
        evidence.checks.verification = true
        await main(['test', 'integration'])
        evidence.checks.integration = true
        const { compatibility } = await import('./compatibility')
        await compatibility(target)
        evidence.checks.compatibility = true
      }
      finally {
        writeJson(resolve(root, '.ci-evidence/qualification.json'), evidence)
      }
      await buildRelease(target)
      await qualifyRelease(target)
      return
    }
    if (name === 'resolve') {
      githubOutput('source_sha', sha(await run(['git', 'rev-parse', 'HEAD'], { quiet: true })))
      return
    }
  }
  throw new Error(`Unknown command.\n${help()}`)
}
if (import.meta.main) {
  try {
    await main(process.argv.slice(2))
  }
  catch (error) {
    console.error(redact(error instanceof Error ? error.message : 'Operation failed'))
    process.exitCode = 1
  }
}
