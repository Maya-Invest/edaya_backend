import { describe, expect, it } from 'bun:test'
import { parseCheckCliArgs } from '../../cli/parse-check-cli'
import { parseDeployCliArgs, wranglerEnvNameForDeployTarget } from '../../cli/parse-deploy-cli'
import { parseSmokeTestCliArgs } from '../../cli/parse-smoke-test-cli'

describe('parseCheckCliArgs', () => {
  it('parses check targets', () => {
    expect(parseCheckCliArgs(['openapi'])).toEqual({ kind: 'run', target: 'openapi' })
    expect(parseCheckCliArgs(['boundaries'])).toEqual({ kind: 'run', target: 'boundaries' })
  })
})

describe('parseSmokeTestCliArgs', () => {
  it('parses smoke-test targets', () => {
    expect(parseSmokeTestCliArgs(['staging'])).toEqual({ kind: 'run', target: 'staging' })
    expect(parseSmokeTestCliArgs(['notify'])).toEqual({ kind: 'run', target: 'notify' })
  })
})

describe('parseDeployCliArgs', () => {
  it('parses api deploy targets', () => {
    expect(parseDeployCliArgs(['api', 'staging'])).toEqual({ kind: 'api', target: 'staging' })
    expect(parseDeployCliArgs(['api', 'production'])).toEqual({ kind: 'api', target: 'production' })
  })

  it('rejects notify as a deploy app', () => {
    expect(() => parseDeployCliArgs(['notify', 'staging'])).toThrow('Only "api" deploy is supported')
  })
})

describe('wranglerEnvNameForDeployTarget', () => {
  it('maps production to wrangler prod env', () => {
    expect(wranglerEnvNameForDeployTarget('staging')).toBe('staging')
    expect(wranglerEnvNameForDeployTarget('production')).toBe('prod')
  })
})
