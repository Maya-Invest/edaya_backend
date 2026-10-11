import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { expect, test } from 'bun:test'
import { commandCatalog } from '../../cli/catalog'
import { commandDocumentation } from '../../cli/command-docs'
import { runDeployCommand } from '../../cli/commands/deploy'
import { CI_COMMANDS } from '../../cli/commands/verify'
import { parseCheckCliArgs } from '../../cli/parse-check-cli'
import { parseDbCliArgs } from '../../cli/parse-db-cli'
import { parseDeployCliArgs } from '../../cli/parse-deploy-cli'
import { parseOpenapiCliArgs } from '../../cli/parse-openapi-cli'
import { parseOperationsCli, pauseValues } from '../../cli/parse-operations-cli'
import { parseSmokeTestCliArgs } from '../../cli/parse-smoke-test-cli'
import { help } from '../../ops/main'

test('unsupported flags cannot turn a preview into a mutation', () => {
  expect(() => parseDbCliArgs(['reset', 'school', 'production', '--yes', '--dry-run'])).toThrow()
  expect(() => parseSmokeTestCliArgs(['r2', '--dry-run'])).toThrow()
  expect(() => parseOpenapiCliArgs(['generate', '--output', 'ignored'])).toThrow()
  expect(() => parseOpenapiCliArgs(['export', '--output'])).toThrow()
  expect(() => parseCheckCliArgs(['boundaries', 'ignored'])).toThrow()
  expect(() => parseDeployCliArgs(['production', '--typo'])).toThrow()
})
test('legacy deployment uses the central emergency confirmation and evidence policy', async () => {
  const parsed = parseDeployCliArgs(['production', '--dry-run'])
  if (parsed.kind === 'help')
    throw new Error('Expected deployment')
  let command: readonly string[] = []
  await runDeployCommand(parsed, async (args) => {
    command = args
    return 0
  })
  expect(command).toEqual(['bun', '--no-env-file', 'tooling/repo/ops/main.ts', 'maintenance', 'emergency-deploy', 'production', '--dry-run'])
})
test('database targets and smoke effects are explicit', () => {
  expect(parseDbCliArgs(['migrate', 'identity', 'production'])).toEqual({ kind: 'identity-migrate', target: 'production' })
  expect(parseDbCliArgs(['migrate', 'school', 'local'])).toEqual({ kind: 'migrate', target: 'local', slice: 'school' })
  expect(parseDbCliArgs(['wipe', 'identity', 'staging', '--yes'])).toEqual({ kind: 'identity-wipe', target: 'staging', yes: true })
  expect(() => parseDbCliArgs(['wipe', 'identity', 'production'])).toThrow()
  expect(parseSmokeTestCliArgs(['api', 'staging'])).toEqual({ kind: 'run', target: 'staging' })
  expect(parseSmokeTestCliArgs(['notify', 'local'])).toEqual({ kind: 'run', target: 'notify' })
  expect(parseSmokeTestCliArgs(['r2', 'staging', '--curl-only'])).toEqual({ kind: 'run', target: 'r2', curlOnly: true })
  expect(() => parseSmokeTestCliArgs(['notify', 'production'])).toThrow()
})
test('pause operations affect only their selected flags', () => {
  expect(pauseValues('scheduler', true)).toEqual({ PAUSE_SCHEDULER: 'true' })
  expect(pauseValues('api', false)).toEqual({ PAUSE_API: 'false' })
  expect(Object.keys(pauseValues('all', true))).toHaveLength(3)
  expect(parseOperationsCli('pause', ['jobs', 'staging', '--dry-run'])).toMatchObject({ action: 'jobs', dryRun: true })
  expect(() => parseOperationsCli('status', ['staging', '--dry-run'])).toThrow()
  expect(() => parseOperationsCli('secrets', ['delete', 'production'])).toThrow()
})
test('help for every command exits without credentials or side effects', () => {
  for (const command of Object.keys(commandCatalog)) {
    const child = Bun.spawnSync([process.execPath, '--no-env-file', join(import.meta.dirname, '../../cli/main.ts'), command, '--help'], {
      env: { ...process.env, AUTH_DATABASE_URL: 'invalid', CLOUDFLARE_API_TOKEN: '', EDAYA_LOCAL_ENV_FILE: '/does-not-exist' },
      timeout: 10000,
    })
    expect(child.exitCode).toBe(0)
    expect(child.stdout.toString()).toContain('Usage:')
  }
})
test('documentation and CI use the shared definitions', () => {
  const root = join(import.meta.dirname, '../../../..')
  expect(readFileSync(join(root, 'docs/reference/repo-cli.md'), 'utf8')).toContain(help().trimEnd())
  expect(readFileSync(join(root, '.github/workflows/_qualify.yml'), 'utf8')).toContain('bun run repo ci qualify')
  expect(CI_COMMANDS).toContainEqual(['bun', 'run', 'repo', 'ci', 'workflows'])
  expect(CI_COMMANDS).toContainEqual(['bun', '--filter', '@edaya/api', 'deploy:staging:dry-run'])
  expect(CI_COMMANDS).toContainEqual(['bun', '--filter', '@edaya/api', 'deploy:production:dry-run'])
})

test('command documentation check catches and repairs drift in the generated table', () => {
  const root = mkdtempSync(join(tmpdir(), 'repo-command-docs-'))
  try {
    mkdirSync(join(root, 'docs/reference'), { recursive: true })
    writeFileSync(join(root, 'docs/reference/repo-cli.md'), '<!-- repo-commands:start -->\nold content\n<!-- repo-commands:end -->')
    expect(() => commandDocumentation(false, root)).toThrow('drift')
    commandDocumentation(true, root)
    expect(() => commandDocumentation(false, root)).not.toThrow()
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('removed aliases and redundant API arguments are rejected', () => {
  expect(() => parseDeployCliArgs(['api', 'production'])).toThrow()
  expect(() => parseOperationsCli('secrets', ['push', 'api', 'staging'])).toThrow()
  expect(() => parseOperationsCli('status', ['api', 'staging'])).toThrow()
  expect(() => parseDbCliArgs(['migrate', 'staging'])).toThrow()
  expect(() => parseDbCliArgs(['reset', 'staging'])).toThrow()
  for (const target of ['staging', 'notify', 'r2']) expect(() => parseSmokeTestCliArgs([target])).toThrow()
})
