import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { expect, test } from 'bun:test'
import { root } from '../runtime'

// GitHub expressions below are literal YAML values.
/* eslint-disable no-template-curly-in-string */
const workflow = (name: string) => Bun.YAML.parse(readFileSync(resolve(root, '.github/workflows', name), 'utf8')) as Record<string, any>
const preparation = 'source'
const entries = ['branche_check.yml', 'pr_validation.yml', 'deploy.yml', 'staging_maintenance.yml']
const mandatory = [preparation, 'quality', 'unit', 'build', 'integration']

// These routing expressions use the common GitHub/JavaScript subset: property
// access, string equality, &&, || and format. Evaluate the actual YAML values.
function render(value: string | boolean, github: Record<string, any>, inputs: Record<string, any> = {}): string {
  return String(value).replace(/\$\{\{([\s\S]*?)\}\}/g, (_, expression: string) => String(runInNewContext(expression, {
    github,
    inputs,
    format: (pattern: string, ...values: unknown[]) => pattern.replace(/\{(\d+)\}/g, (_, index: string) => String(values[Number(index)])),
  })))
}
function shell(script: string, env: Record<string, string>): number {
  return Bun.spawnSync(['bash', '-e', '-c', script], { env: { ...process.env, ...env }, stdout: 'pipe', stderr: 'pipe' }).exitCode
}

test('entry workflows contain only reusable callers and every reusable workflow is reachable', () => {
  const files = readdirSync(resolve(root, '.github/workflows')).filter(name => name.endsWith('.yml'))
  expect(files.filter(name => !name.startsWith('_')).sort()).toEqual([...entries].sort())
  const reached = new Set<string>()
  function visit(name: string): void {
    if (reached.has(name))
      return
    reached.add(name)
    const definition = workflow(name)
    for (const job of Object.values(definition.jobs) as any[]) {
      if (entries.includes(name)) {
        expect(Object.keys(job).every(key => ['uses', 'needs', 'if', 'with', 'secrets'].includes(key))).toBe(true)
        expect(job.uses).toMatch(/^\.\/\.github\/workflows\/_/)
      }
      if (job.uses?.startsWith('./.github/workflows/')) {
        const called = job.uses.split('/').at(-1)
        expect(existsSync(resolve(root, '.github/workflows', called))).toBe(true)
        expect(workflow(called).on.workflow_call).toBeDefined()
        visit(called)
      }
    }
  }
  for (const entry of entries) {
    expect(workflow(entry).name).toBe(entry === 'staging_maintenance.yml' ? 'staging maintenance' : entry.replace('.yml', ''))
    visit(entry)
  }
  expect([...reached].sort()).toEqual(files.sort())
})

test('branch checks prepare immutable inputs then run only parallel quality and unit jobs', () => {
  const branch = workflow('branche_check.yml')
  expect(branch.on.push['branches-ignore']).toEqual(['main', 'staging'])
  expect(Object.keys(branch.jobs)).toEqual([preparation, 'quality', 'unit'])
  expect(branch.concurrency['cancel-in-progress']).toBe(true)
  expect(render(branch.concurrency.group, { ref: 'refs/heads/feature' })).toBe('branch-refs/heads/feature')
  expect(branch.jobs[preparation].uses).toBe('./.github/workflows/_prepare.yml')
  expect(branch.jobs[preparation].with.release_mode).toBeUndefined()
  for (const name of ['quality', 'unit']) {
    expect(branch.jobs[name].needs).toBe(preparation)
    expect(branch.jobs[name].with.target).toBe('staging')
  }
})

test('validation and release expose the complete graph and immutable identities', () => {
  for (const name of ['pr_validation.yml', 'deploy.yml']) {
    const jobs = workflow(name).jobs
    for (const stage of ['quality', 'unit', 'build']) {
      expect(jobs[stage].needs).toBe(preparation)
      expect(jobs[stage].if).toBeUndefined()
    }
    expect(jobs.integration.needs).toEqual([preparation, 'quality', 'unit'])
    expect(jobs.qualification.needs).toEqual(mandatory)
    expect(jobs.qualification.if).toBe('always()')
    expect(jobs.qualification.uses).toBe('./.github/workflows/_finalize.yml')
    expect(jobs.qualification.with.job_results).toBe('${{ toJSON(needs) }}')
    for (const stage of ['quality', 'unit', 'build', 'integration', 'qualification']) {
      const sourceKey = stage === 'qualification' ? 'source_sha' : 'source_ref'
      expect(jobs[stage].with[sourceKey]).toBe(`\${{ needs.${preparation}.outputs.source_sha }}`)
    }
  }
  const prepare = workflow('_prepare.yml')
  expect(prepare.on.workflow_call.outputs.source_sha.value).toBe(`\${{ jobs.${preparation}.outputs.source_sha }}`)
  const checkout = prepare.jobs[preparation].steps.find((step: any) => step.uses?.startsWith('actions/checkout@'))
  expect(checkout.with.ref).toBe('${{ inputs.source_ref }}')
  expect(prepare.jobs[preparation].steps.find((step: any) => step.id === 'source').run).toContain('git rev-parse HEAD')
})

test('PR and manual validation preserve source selection, defaults and independent cancellation', () => {
  const validation = workflow('pr_validation.yml')
  expect(validation.on.pull_request.branches).toEqual(['main', 'staging'])
  expect(validation.on.workflow_dispatch.inputs.target).toMatchObject({ default: 'staging', options: ['staging', 'production'] })
  expect(validation.on.workflow_dispatch.inputs.source_ref.default).toBe('')
  expect(Object.keys(validation.jobs)).toEqual([...mandatory, 'qualification'])
  expect(validation.concurrency['cancel-in-progress']).toBe(true)
  for (const [base, target] of [['main', 'production'], ['staging', 'staging']]) {
    const github = { event_name: 'pull_request', base_ref: base, sha: 'merge-sha', event: { pull_request: { number: 42, base: { sha: 'base-sha' } } } }
    for (const job of Object.values(validation.jobs) as any[])
      expect(render(job.with.target, github)).toBe(target!)
    expect(render(validation.jobs[preparation].with.source_ref, github)).toBe('merge-sha')
    expect(render(validation.jobs.integration.with.baseline_sha, github)).toBe('base-sha')
    expect(render(validation.concurrency.group, github)).toBe('pr-42')
  }
  for (const target of ['staging', 'production']) {
    for (const source_ref of ['', 'override-sha']) {
      const github = { event_name: 'workflow_dispatch', ref: 'refs/heads/feature', sha: 'workflow-sha', event: { pull_request: { base: {} } } }
      const inputs = { target, source_ref }
      for (const job of Object.values(validation.jobs) as any[])
        expect(render(job.with.target, github, inputs)).toBe(target)
      expect(render(validation.jobs[preparation].with.source_ref, github, inputs)).toBe(source_ref || 'workflow-sha')
      expect(render(validation.jobs.integration.with.baseline_sha, github, inputs)).toBe('')
      expect(render(validation.concurrency.group, github, inputs)).toBe(`validation-refs/heads/feature-${target}`)
    }
  }
})

test('deploy derives its target and serial lock from the workflow branch, independent of source overrides', () => {
  const deploy = workflow('deploy.yml')
  expect(deploy.on.push.branches).toEqual(['main', 'staging'])
  expect(Object.keys(deploy.on.workflow_dispatch.inputs)).toEqual(['source_ref'])
  expect(deploy.jobs[preparation].with.release_mode).toBe(true)
  expect(deploy.concurrency['cancel-in-progress']).toBe(false)
  for (const [branch, target] of [['main', 'production'], ['staging', 'staging']]) {
    for (const event_name of ['push', 'workflow_dispatch']) {
      for (const source_ref of ['', 'other-branch-or-sha']) {
        const github = { event_name, ref_name: branch, sha: 'workflow-sha' }
        const inputs = { source_ref }
        for (const job of Object.values(deploy.jobs) as any[])
          expect(render(job.with.target, github, inputs)).toBe(target!)
        expect(render(deploy.jobs[preparation].with.source_ref, github, inputs)).toBe(source_ref || 'workflow-sha')
        expect(render(deploy.concurrency.group, github, inputs)).toBe(`deploy-${target}`)
      }
    }
  }
})

test('release guard rejects invalid workflow branches, tags and mismatched targets before checkout', () => {
  const prepare = workflow('_prepare.yml')
  expect(prepare.on.workflow_call.inputs.release_mode.default).toBe(false)
  const gate = prepare.jobs[preparation].steps[0]
  expect(gate.name).toBe('Validate release destination')
  expect(gate.env).toEqual({ RELEASE_MODE: '${{ inputs.release_mode }}', REF_TYPE: '${{ github.ref_type }}', REF_NAME: '${{ github.ref_name }}', TARGET: '${{ inputs.target }}' })
  for (const REF_TYPE of ['branch', 'tag']) {
    for (const REF_NAME of ['main', 'staging', 'feature', 'v1']) {
      for (const TARGET of ['production', 'staging']) {
        const valid = REF_TYPE === 'branch' && ((REF_NAME === 'main' && TARGET === 'production') || (REF_NAME === 'staging' && TARGET === 'staging'))
        expect(shell(gate.run, { RELEASE_MODE: 'true', REF_TYPE, REF_NAME, TARGET })).toBe(valid ? 0 : 1)
        expect(shell(gate.run, { RELEASE_MODE: 'false', REF_TYPE, REF_NAME, TARGET })).toBe(0)
      }
    }
  }
})

test('finalization rejects missing, failed, skipped, cancelled or malformed prerequisites before checkout', () => {
  const finalize = workflow('_finalize.yml').jobs.qualification
  expect(finalize.name).toBe('Full validation')
  const gate = finalize.steps[0]
  expect(gate.name).toBe('Require every task to succeed')
  expect(gate.env.RESULTS).toBe('${{ inputs.job_results }}')
  const results = Object.fromEntries(mandatory.map(name => [name, { result: 'success' }]))
  expect(shell(gate.run, { RESULTS: JSON.stringify(results) })).toBe(0)
  for (const name of mandatory) {
    for (const result of ['failure', 'cancelled', 'skipped', '', null])
      expect(shell(gate.run, { RESULTS: JSON.stringify({ ...results, [name]: { result } }) })).not.toBe(0)
    const missing = { ...results }
    delete missing[name]
    expect(shell(gate.run, { RESULTS: JSON.stringify(missing) })).not.toBe(0)
  }
  for (const RESULTS of ['{}', '[]', 'null', '', 'not JSON'])
    expect(shell(gate.run, { RESULTS })).not.toBe(0)
  expect(finalize.steps[1].with.ref).toBe('${{ inputs.source_sha }}')
  expect(finalize.steps.at(-1).uses).toBe('./.github/actions/finalize')
})

test('quality caches accelerate analysis without skipping any phase or caching qualification evidence', () => {
  const steps = workflow('_quality_check.yml').jobs['quality-check'].steps
  for (const part of ['checks', 'lint', 'types']) {
    const step = steps.find((step: any) => step.run === `bun run repo ci quality ${part}`)
    expect(step).toBeDefined()
    expect(step.if).toBeUndefined()
  }
  expect(steps.find((step: any) => step.run === 'bun run repo ci quality finalize').if).toBe('always()')
  const cache = steps.find((step: any) => step.name === 'Restore quality caches')
  expect(cache.with.path).toContain('.cache/quality/')
  expect(cache.with.path).not.toMatch(/\.release|\.ci-evidence|node_modules/)
  const setup = Bun.YAML.parse(readFileSync(resolve(root, '.github/actions/setup/action.yml'), 'utf8')) as Record<string, any>
  const install = setup.runs.steps.find((step: any) => step.run === 'bun install --ignore-scripts --frozen-lockfile')
  expect(install).toBeDefined()
  expect(install.if).toBeUndefined()
})

test('releases require qualification then migration, with default success gating and environment protections', () => {
  const jobs = workflow('deploy.yml').jobs
  expect(jobs.migration.needs).toEqual(['source', 'qualification'])
  expect(jobs.deployment.needs).toEqual(['source', 'migration'])
  for (const name of ['migration', 'deployment']) {
    expect(jobs[name].if).toBeUndefined()
    expect(jobs[name].with.source_ref).toBe('${{ needs.source.outputs.source_sha }}')
    const job = workflow(`_${name}.yml`).jobs[name]
    expect(job.environment).toBe('${{ inputs.target }}')
    const commands = job.steps.map((step: any) => step.run ?? '').join('\n')
    expect(commands).toContain('restore.ts')
    expect(commands).not.toMatch(/ci qualify|test integration|ci build|generate client/)
  }
})

test('integration keeps all three independent groups and bounded concurrency', () => {
  const integration = workflow('_integration_test.yml').jobs.integration
  expect(integration.strategy['max-parallel']).toBe(3)
  expect(integration.strategy['fail-fast']).toBe(false)
  expect(integration.strategy.matrix.group).toEqual(['services', 'adapters-http', 'seed-native'])
})

test('maintenance remains manual, protected, dry by default and serialized with staging deployment', () => {
  const entry = workflow('staging_maintenance.yml')
  expect(Object.keys(entry.on)).toEqual(['workflow_dispatch'])
  expect(entry.concurrency).toEqual({ 'group': 'deploy-staging', 'cancel-in-progress': false })
  expect(entry.on.workflow_dispatch.inputs.operation).toMatchObject({ options: ['reset-reseed', 'recover'], default: 'reset-reseed' })
  expect(entry.on.workflow_dispatch.inputs.dry_run.default).toBe(true)
  expect(entry.on.workflow_dispatch.inputs.confirmation.description).toContain('STAGING MAINTENANCE')
  expect(entry.jobs.maintenance.with).toEqual({ operation: '${{ inputs.operation }}', dry_run: '${{ inputs.dry_run }}', confirmation: '${{ inputs.confirmation }}' })
  const reusable = workflow('_maintenance.yml')
  expect(reusable.on.workflow_call.inputs.dry_run.default).toBe(true)
  expect(reusable.jobs.maintenance.environment).toBe('staging')
  const step = reusable.jobs.maintenance.steps.find((step: any) => step.run === 'bun run repo ci maintenance')
  expect(step.env.MAINTENANCE_OPERATION).toBe('${{ inputs.operation }}')
  expect(step.env.MAINTENANCE_DRY_RUN).toBe('${{ inputs.dry_run }}')
  expect(step.env.MAINTENANCE_CONFIRMATION).toBe('${{ inputs.confirmation }}')
})
