import { mkdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { clientArguments, seedArguments } from './arguments'
import { commandDocs } from './command-docs'
import { main, reference } from './main'
import { buildRelease, deployRelease, qualifyRelease, validateRelease } from './release'
import { assertCommittedSource, environment, githubOutput, root, run, sha, verificationPhase, writeJson } from './runtime'
import { tool } from './tools'

export async function executeCommand(args: string[]): Promise<void> {
  const [group, name, ...rest] = args
  const script = (path: string, forward: string[] = []) => run(['bun', '--no-env-file', path, ...forward])
  if (group === 'check') {
    const scripts: Record<string, string> = { 'doctor': 'ci/doctor.ts', 'openapi': 'openapi/check-drift.ts', 'boundaries': 'ci/check-boundaries.ts', 'test-naming': 'ci/check-test-naming.ts' }
    if (!name || name === 'commands')
      commandDocs(reference())
    for (const file of name ? (scripts[name] ? [scripts[name]!] : []) : Object.values(scripts))
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
    if (name === 'client') {
      await script('tooling/repo/codegen/bin/edaya-codegen.ts', clientArguments(rest))
      return
    }
    if (name === 'schema') {
      await script('tooling/repo/openapi/export.ts', rest)
      return
    }
    if (name === 'openapi' && !rest.length) {
      await script('tooling/repo/openapi/update.ts')
      return
    }
    if (name === 'commands' && !rest.length) {
      const { writeFileSync } = await import('node:fs')
      writeFileSync(resolve(root, 'tooling/repo/ops/commands.txt'), reference())
      commandDocs(reference(), true)
      return
    }
  }
  if (group === 'test' && !rest.length) {
    if (name === 'tooling') {
      await run(['bun', 'run', 'test'], { cwd: resolve(root, 'tooling/repo') })
      return
    }
    if (name === 'unit') {
      await run(['bun', 'run', 'test'], { timeout: 120 * 60000 })
      return
    }
    if (name === 'integration') {
      await run(['bun', 'run', 'test:integration'], { timeout: 120 * 60000 })
      return
    }
  }
  if (group === 'build' && !rest.length) {
    await buildRelease(environment(name))
    return
  }
  if (group === 'ops' && name) {
    if (name === 'reset' || name === 'recover') {
      const { maintenance } = await import('./maintenance')
      await maintenance([...rest, ...(name === 'recover' ? ['--recover'] : [])])
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
      const { dispatchOperation } = await import('./operation-dispatch')
      const { config } = await import('dotenv')
      config({ path: resolve(root, '.env') })
      const code = await dispatchOperation(name as 'db' | 'seed' | 'vars' | 'secrets' | 'pause' | 'resume' | 'status' | 'smoke', name === 'seed' ? seedArguments(rest) : rest)
      if (code)
        throw new Error(`Operation ${name} failed`)
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
      await main(['ops', process.env.MAINTENANCE_OPERATION === 'recover' ? 'recover' : 'reset', 'staging', dry === 'true' ? '--dry-run' : '--yes'])
      return
    }
    if (name === 'workflows') {
      await run([await tool('actionlint'), '-shellcheck=', ...Array.from(new Bun.Glob('.github/workflows/*.yml').scanSync({ cwd: root }))])
      return
    }
    if (name === 'verify') {
      await verificationPhase('repository checks', () => main(['check']))
      await verificationPhase('workflow lint', () => main(['ci', 'workflows']))
      await verificationPhase('lint and type checks', () => run(['bun', 'run', 'quality']))
      await verificationPhase('workspace build', () => run(['bun', 'run', 'build']))
      await verificationPhase('workspace tests (including tooling)', () => main(['test', 'unit']))
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
      await main(['ops', 'db', 'migrate', 'identity', target])
      await main(['ops', 'db', 'migrate', 'school', target])
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
  throw new Error(`Unknown command.\n${reference()}`)
}
