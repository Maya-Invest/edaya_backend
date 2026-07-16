import { describe, expect, it } from 'bun:test'
import { parseVerifyCliArgs } from '../../cli/parse-verify-cli'

describe('parseVerifyCliArgs', () => {
  it('defaults to hygiene-only verify', () => {
    expect(parseVerifyCliArgs([])).toEqual({ kind: 'run', full: false })
  })

  it('parses --full', () => {
    expect(parseVerifyCliArgs(['--full'])).toEqual({ kind: 'run', full: true })
  })

  it('returns help for -h / --help', () => {
    expect(parseVerifyCliArgs(['--help'])).toEqual({ kind: 'help' })
    expect(parseVerifyCliArgs(['-h'])).toEqual({ kind: 'help' })
  })

  it('rejects unknown options', () => {
    expect(() => parseVerifyCliArgs(['--coverage'])).toThrow(/Unknown verify option/)
  })
})
