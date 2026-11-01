import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'bun:test'
import { parseDbCliArgs } from '../../cli/parse-db-cli'
import { parseOperationsCli, pauseValues } from '../../cli/parse-operations-cli'
import { parseSmokeTestCliArgs } from '../../cli/parse-smoke-test-cli'
import { commandDocs } from '../../ops/command-docs'
import { resolveCommand } from '../../ops/command-tree'
import { commands, removedCommands } from '../../ops/commands'
import { reference } from '../../ops/main'

const parse = (args: string[]) => resolveCommand(commands, args, removedCommands)

test('unsupported flags cannot turn a preview into a mutation', () => {
  expect(() => parseDbCliArgs(['reset', 'school', 'production', '--yes', '--dry-run'])).toThrow()
  expect(() => parseSmokeTestCliArgs(['r2', '--dry-run'])).toThrow()
  expect(() => parse(['generate', 'openapi', '--output', 'ignored'])).toThrow()
  expect(() => parse(['generate', 'schema', '--output'])).toThrow()
  expect(() => parse(['check', 'boundaries', 'ignored'])).toThrow()
  expect(() => parse(['ops', 'emergency-deploy', 'production', '--typo'])).toThrow()
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
test('documentation and CI use the shared definitions', () => {
  const root = join(import.meta.dirname, '../../../..')
  expect(readFileSync(join(root, 'docs/reference/repo-cli.md'), 'utf8')).toContain(reference().trimEnd())
  expect(readFileSync(join(root, '.github/actions/finalize/action.yml'), 'utf8')).toContain('bun run repo ci finalize')
})

test('command documentation check catches and repairs drift in the generated table', () => {
  const root = mkdtempSync(join(tmpdir(), 'repo-command-docs-'))
  try {
    mkdirSync(join(root, 'docs/reference'), { recursive: true })
    writeFileSync(join(root, 'docs/reference/repo-cli.md'), '<!-- repo-commands:start -->\nold content\n<!-- repo-commands:end -->')
    expect(() => commandDocs(reference(), false, root)).toThrow('drift')
    commandDocs(reference(), true, root)
    expect(() => commandDocs(reference(), false, root)).not.toThrow()
  }
  finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('removed aliases and redundant API arguments are rejected', () => {
  expect(() => parse(['ops', 'emergency-deploy', 'api', 'production'])).toThrow()
  expect(() => parseOperationsCli('secrets', ['push', 'api', 'staging'])).toThrow()
  expect(() => parseOperationsCli('status', ['api', 'staging'])).toThrow()
  expect(() => parseDbCliArgs(['migrate', 'staging'])).toThrow()
  expect(() => parseDbCliArgs(['reset', 'staging'])).toThrow()
  for (const target of ['staging', 'notify', 'r2']) expect(() => parseSmokeTestCliArgs([target])).toThrow()
})
