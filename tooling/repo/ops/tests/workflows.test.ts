import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { root } from '../runtime'

const workflow = (name: string) => Bun.YAML.parse(readFileSync(resolve(root, '.github/workflows', name), 'utf8')) as Record<string, any>
test('feature pushes run quality and unit independently without integration or build', () => {
  const push = workflow('push.yml')
  expect(push.on.push['branches-ignore']).toEqual(['main', 'staging'])
  expect(Object.keys(push.jobs)).toEqual(['source', 'quality', 'unit'])
  expect(push.jobs.quality.needs).toBe('source')
  expect(push.jobs.unit.needs).toBe('source')
})
test('PR qualification joins all tasks and refuses failed or skipped predecessors', () => {
  const pr = workflow('deploy_pr.yml')
  expect(pr.on.pull_request.branches).toEqual(['main', 'staging'])
  expect(pr.jobs.integration.needs).toEqual(['source', 'quality', 'unit'])
  expect(pr.jobs.qualification.needs).toEqual(['source', 'quality', 'unit', 'build', 'integration'])
  expect(pr.jobs.qualification.if).toBe('always()')
  expect(pr.jobs.qualification.steps[0].run).toContain('.result == "success"')
  expect(pr.jobs.migration).toBeUndefined()
  expect(pr.jobs.deployment).toBeUndefined()
})
test('releases serialize and require fresh qualification, migration, then exact-artifact deployment', () => {
  for (const [environment, branch] of [['staging', 'staging'], ['production', 'main']]) {
    const release = workflow(`deploy-${environment}.yml`)
    expect(release.on.push.branches).toEqual([branch])
    expect(release.concurrency['cancel-in-progress']).toBe(false)
    expect(release.jobs.migration.needs).toEqual(['source', 'qualification'])
    expect(release.jobs.deployment.needs).toEqual(['source', 'migration'])
    expect(release.jobs.migration.if).toBe('vars.ENABLE_INDEPENDENT_RELEASES == \'true\'')
    expect(release.jobs.deployment.if).toBe(release.jobs.migration.if)
    for (const name of ['migration', 'deployment']) {
      const definition = workflow(`_${name}.yml`)
      expect(definition.jobs[name].environment).toContain('inputs.target')
      const commands = definition.jobs[name].steps.map((step: any) => step.run ?? '').join('\n')
      expect(commands).toContain('restore.ts')
      expect(commands).not.toMatch(/ci qualify|test integration|ci build|generate client/)
    }
  }
})
test('integration groups use independent runners with bounded concurrency and all reports retained', () => {
  const integration = workflow('_integration-test.yml').jobs.integration
  expect(integration.strategy['max-parallel']).toBe(3)
  expect(integration.strategy['fail-fast']).toBe(false)
  expect(integration.strategy.matrix.group).toEqual(['services', 'adapters-http', 'seed-native'])
})
test('manual validation never deploys; maintenance stays manual and serialized with staging releases', () => {
  const validation = workflow('validate.yml')
  expect(validation.on.workflow_dispatch).toBeDefined()
  expect(validation.jobs.migration).toBeUndefined()
  const maintenance = workflow('maintenance-staging.yml')
  expect(Object.keys(maintenance.on)).toEqual(['workflow_dispatch'])
  expect(maintenance.concurrency.group).toBe(workflow('deploy-staging.yml').concurrency.group)
  expect(maintenance.on.workflow_dispatch.inputs.dry_run.default).toBe(true)
})

test('quality caches accelerate analysis without skipping any phase or caching qualification evidence', () => {
  const steps = workflow('_quality-check.yml').jobs['quality-check'].steps
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
