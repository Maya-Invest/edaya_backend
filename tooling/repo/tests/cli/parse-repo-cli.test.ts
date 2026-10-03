import { join } from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'bun:test'
import { parseRepoCliArgs } from '../../cli/parse-repo-cli'
import { resolveRepoCommandScript } from '../../cli/registry'

describe('parseRepoCliArgs', () => {
  it('returns help when no command is given', () => {
    expect(parseRepoCliArgs(['bun', 'repo'])).toEqual({ kind: 'help' })
  })

  it('parses dev, seed, doctor, and db', () => {
    expect(parseRepoCliArgs(['bun', 'repo', 'dev'])).toEqual({
      kind: 'run',
      command: 'dev',
      forwardArgs: [],
    })
    expect(parseRepoCliArgs(['bun', 'repo', 'seed', '--staging'])).toEqual({
      kind: 'run',
      command: 'seed',
      forwardArgs: ['--staging'],
    })
    expect(parseRepoCliArgs(['bun', 'repo', 'doctor'])).toEqual({
      kind: 'run',
      command: 'doctor',
      forwardArgs: [],
    })
    expect(parseRepoCliArgs(['bun', 'repo', 'dev-container', 'up'])).toEqual({
      kind: 'run',
      command: 'dev-container',
      forwardArgs: ['up'],
    })
    expect(parseRepoCliArgs(['bun', 'repo', 'db', 'migrate', 'local'])).toEqual({
      kind: 'run',
      command: 'db',
      forwardArgs: ['migrate', 'local'],
    })
    expect(parseRepoCliArgs(['bun', 'repo', 'check', 'openapi'])).toEqual({
      kind: 'run',
      command: 'check',
      forwardArgs: ['openapi'],
    })
    expect(parseRepoCliArgs(['bun', 'repo', 'verify'])).toEqual({
      kind: 'run',
      command: 'verify',
      forwardArgs: [],
    })
    expect(parseRepoCliArgs(['bun', 'repo', 'verify', '--full'])).toEqual({
      kind: 'run',
      command: 'verify',
      forwardArgs: ['--full'],
    })
  })

  it('forwards --help to subcommands', () => {
    expect(parseRepoCliArgs(['bun', 'repo', 'seed', '--help'])).toEqual({
      kind: 'run',
      command: 'seed',
      forwardArgs: ['--help'],
    })
  })

  it('forwards generator and identity arguments to the relocated scripts', () => {
    for (const command of ['codegen', 'identity-migrate', 'identity-wipe'] as const) {
      expect(parseRepoCliArgs(['bun', 'repo', command, 'staging', '--yes'])).toEqual({
        kind: 'run',
        command,
        forwardArgs: ['staging', '--yes'],
      })
    }
    expect(resolveRepoCommandScript('codegen')).toEndWith(join('repo', 'codegen', 'bin', 'edaya-codegen.ts'))
    expect(resolveRepoCommandScript('identity-migrate')).toEndWith(join('repo', 'db', 'identity', 'migrate.ts'))
    expect(resolveRepoCommandScript('identity-wipe')).toEndWith(join('repo', 'db', 'identity', 'wipe.ts'))
  })

  it('rejects unknown commands', () => {
    expect(() => parseRepoCliArgs(['bun', 'repo', 'foobar']))
      .toThrow(/Unknown repo command/)
  })

  it('identity help exits before starting a database command, even with --yes', () => {
    for (const command of ['identity-migrate', 'identity-wipe']) {
      const result = Bun.spawnSync([
        process.execPath,
        '--no-env-file',
        join(import.meta.dirname, '../../cli/main.ts'),
        command,
        '--help',
        '--yes',
      ], {
        env: { ...process.env, AUTH_DATABASE_URL: 'invalid-for-help-check' },
      })
      expect(result.exitCode).toBe(0)
      expect(result.stdout.toString()).toContain(`Usage: bun repo ${command}`)
    }
  })
})

describe('resolveRepoCommandScript', () => {
  it('resolves script paths under the monorepo', () => {
    expect(resolveRepoCommandScript('dev')).toEndWith(join('tooling', 'repo', 'dev', 'start-local-dev.ts'))
    expect(resolveRepoCommandScript('seed')).toEndWith(join('tooling', 'seeding', 'scripts', 'seed.ts'))
    expect(resolveRepoCommandScript('doctor')).toEndWith(join('tooling', 'repo', 'ci', 'doctor.ts'))
  })
})
