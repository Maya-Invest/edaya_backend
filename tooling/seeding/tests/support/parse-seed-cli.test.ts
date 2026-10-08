import { describe, expect, it } from 'bun:test'
import { parseSeedCliArgs, seedCliUsage } from '../../src/support/parse-seed-cli'

describe('parseSeedCliArgs', () => {
  it('defaults to local full seed', () => {
    expect(parseSeedCliArgs(['bun', 'seed.ts'])).toEqual({
      kind: 'seed',
      target: 'local',
      scope: 'all',
      clean: false,
      repair: false,
      skipProfilePhotos: false,
      skipAttachments: false,
      noProgress: false,
    })
  })

  it('parses staging, scope, and flags', () => {
    expect(parseSeedCliArgs([
      'bun',
      'seed.ts',
      '--staging',
      '--scope',
      'auth:link',
      '--clean',
      '--repair',
      '--skip-profile-photos',
    ])).toEqual({
      kind: 'seed',
      target: 'staging',
      scope: 'auth:link',
      clean: true,
      repair: true,
      skipProfilePhotos: true,
      skipAttachments: false,
      noProgress: false,
    })
  })

  it('parses clean subcommand', () => {
    expect(parseSeedCliArgs(['bun', 'seed.ts', 'clean'])).toEqual({
      kind: 'clean',
      target: 'local',
      yes: false,
    })
    expect(parseSeedCliArgs(['bun', 'seed.ts', 'clean', '--staging', '--yes'])).toEqual({
      kind: 'clean',
      target: 'staging',
      yes: true,
    })
    expect(() => parseSeedCliArgs(['bun', 'seed.ts', 'clean', '--auth'])).toThrow(/apps\/api\/src\/identity/)
  })

  it('returns help when requested', () => {
    expect(parseSeedCliArgs(['bun', 'seed.ts', '--help'])).toEqual({ kind: 'help' })
  })

  it('rejects unknown scopes', () => {
    expect(() => parseSeedCliArgs(['bun', 'seed.ts', '--scope', 'smoke']))
      .toThrow(/Unknown seed scope/)
  })

  it('documents the lean command set', () => {
    expect(seedCliUsage()).toContain('bun repo seed clean')
    expect(seedCliUsage()).toContain('bun repo seed --staging')
    expect(seedCliUsage()).not.toContain('seed:smoke')
  })
})


describe('seed command safety', () => {
  it('rejects ignored, duplicate and incomplete flags', () => {
    for (const flags of [
      ['--dry-run'], ['clean', '--scope', 'school'], ['--scope'],
      ['--scope', '--clean'], ['--staging', '--staging'],
      ['--yes'], ['clean', '--yes', '-y'],
    ]) {
      expect(() => parseSeedCliArgs(['bun', 'seed.ts', ...flags])).toThrow()
    }
  })
  it('requires explicit confirmation bypass for either cleanup spelling', () => {
    expect(parseSeedCliArgs(['bun', 'seed.ts', '--clean'])).not.toHaveProperty('yes')
    expect(parseSeedCliArgs(['bun', 'seed.ts', '--clean', '--yes'])).toMatchObject({ clean: true, yes: true })
    expect(parseSeedCliArgs(['bun', 'seed.ts', 'clean'])).toMatchObject({ yes: false })
  })
})
