import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { clientArguments, seedArguments } from '../arguments'
import { resolveCommand } from '../command-tree'
import { commands, removedCommands } from '../commands'
import { root } from '../runtime'

const parse = (args: string[]) => resolveCommand(commands, args, removedCommands)

test('seed targets preserve implementation arguments and default to local', () => {
  for (const [args, expected] of [
    [[], []],
    [['local'], []],
    [['staging', '--scope', 'doctor'], ['--staging', '--scope', 'doctor']],
    [['--scope', 's2s-clients'], ['--scope', 's2s-clients']],
    [['staging', '--scope', 's2s-clients'], ['--staging', '--scope', 's2s-clients']],
    [['clean'], ['clean']],
    [['clean', 'staging', '-y'], ['clean', '--staging', '--yes']],
    [['--clean', '--yes'], ['--clean', '--yes']],
  ] as [string[], string[]][]) {
    const result = parse(['ops', 'seed', ...args])
    const rest = [...result.invocation.path.slice(2), ...result.invocation.argv]
    expect(seedArguments(rest)).toEqual(expected)
  }
  expect(() => parse(['ops', 'seed', 'production'])).toThrow('Invalid target')
  expect(() => parse(['ops', 'seed', '--yes'])).toThrow('--yes requires')
  expect(() => parse(['ops', 'seed', 'staging', '--staging'])).toThrow('Use bun repo ops seed staging')
})

test('client generation preserves options and does not mistake option values for flags', () => {
  const base = ['--input', 'schema.json', '--client-dir', 'client']
  expect(clientArguments(parse(['generate', 'client', ...base]).invocation.argv)).toEqual(['generate', ...base])
  expect(clientArguments(parse(['generate', 'client', '--check', ...base]).invocation.argv)).toEqual(['check', ...base])
  expect(clientArguments(['--input', '--check', '--client-dir', 'client'])).toEqual(['generate', '--input', '--check', '--client-dir', 'client'])
  const result = parse(['generate', 'client', ...base, '--header', 'X-Mode: --help', '--header', 'X-Other: value'])
  expect(result.help).toBe(false)
  expect(result.invocation.options['--header']).toEqual(['X-Mode: --help', 'X-Other: value'])
  expect(() => parse(['generate', 'client', '--input', 'schema.json'])).toThrow('output artifact')
  expect(() => parse(['generate', 'client', '--client-dir', 'client'])).toThrow('--input is required')
})

test('fixture forwards child flags without intercepting their help', () => {
  const result = parse(['ci', 'fixture', '.', '--', 'bun', 'test', '--help'])
  expect(result.help).toBe(false)
  expect(result.invocation.forwarded).toEqual(['bun', 'test', '--help'])
  expect(result.invocation.argv).toEqual(['.', '--', 'bun', 'test', '--help'])
  expect(parse(['ci', 'fixture', '--help']).help).toBe(true)
  expect(() => parse(['ci', 'fixture', '.', '--'])).toThrow('child command')
})

test('reset and recovery retain staging-only explicit confirmation', () => {
  for (const command of ['reset', 'recover']) {
    expect(() => parse(['ops', command, 'staging'])).toThrow('requires explicit --yes')
    expect(() => parse(['ops', command, 'production', '--yes'])).toThrow('Invalid environment')
    expect(parse(['ops', command, 'staging', '--dry-run']).help).toBe(false)
    expect(parse(['ops', command, '--yes', '--help']).help).toBe(true)
  }
})

test('public client generation and check execute against disposable output', () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-client-command-'))
  try {
    const output = resolve(directory, 'schema.d.ts')
    const args = [process.execPath, '--no-env-file', resolve(root, 'tooling/repo/ops/main.ts'), 'generate', 'client', '--input', resolve(root, 'tooling/repo/codegen/tests/fixtures/minimal-openapi.json'), '--schema-out', output]
    const generate = Bun.spawnSync(args, { cwd: directory, timeout: 15000 })
    expect(generate.exitCode).toBe(0)
    const generated = readFileSync(output, 'utf8')
    expect(generated).toContain('export')
    expect(Bun.spawnSync([...args, '--check'], { cwd: directory, timeout: 15000 }).exitCode).toBe(0)
    writeFileSync(output, 'changed')
    expect(Bun.spawnSync([...args, '--check'], { cwd: directory, timeout: 15000 }).exitCode).not.toBe(0)
    expect(readFileSync(output, 'utf8')).toBe('changed')
  }
  finally { rmSync(directory, { recursive: true, force: true }) }
}, 45000)

test('missing option values before help show the leaf help', () => {
  expect(parse(['generate', 'client', '--input', '--help']).help).toBe(true)
  expect(parse(['generate', 'schema', '--output', '-h']).help).toBe(true)
  expect(() => parse(['generate', 'schema', '--output', '--typo'])).toThrow('Unknown option')
  const literal = parse(['generate', 'schema', '--output=--help'])
  expect(literal.help).toBe(false)
  expect(literal.invocation.argv).toEqual(['--output', '--help'])
})
