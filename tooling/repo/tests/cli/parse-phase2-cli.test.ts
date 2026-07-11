import { describe, expect, it } from 'bun:test'
import { parseCheckCliArgs } from '../../cli/parse-check-cli'
import { parseDeployCliArgs } from '../../cli/parse-deploy-cli'
import { parseNovuCliArgs } from '../../cli/parse-novu-cli'
// import { parseOpenapiCliArgs } from '../../cli/parse-openapi-cli'
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
    expect(parseSmokeTestCliArgs(['novu'])).toEqual({ kind: 'run', target: 'novu' })
  })
})

describe('parseDeployCliArgs', () => {
  it('parses api deploy targets', () => {
    expect(parseDeployCliArgs(['api', 'staging'])).toEqual({ kind: 'api', target: 'staging' })
  })
})

describe('parseNovuCliArgs', () => {
  it('parses novu bootstrap and cleanup', () => {
    expect(parseNovuCliArgs(['bootstrap'])).toEqual({ kind: 'bootstrap', action: 'plan' })
    expect(parseNovuCliArgs(['bootstrap', 'apply'])).toEqual({ kind: 'bootstrap', action: 'apply' })
    expect(parseNovuCliArgs(['cleanup', 'apply', '--yes'])).toEqual({
      kind: 'cleanup',
      action: 'apply',
      forwardArgs: ['--yes'],
    })
  })
})

// describe('parseOpenapiCliArgs', () => {
//   it('parses openapi actions', () => {
//     expect(parseOpenapiCliArgs(['export'])).toEqual({ kind: 'run', action: 'export' })
//     expect(parseOpenapiCliArgs(['generate'])).toEqual({ kind: 'run', action: 'generate' })
//   })
// })
