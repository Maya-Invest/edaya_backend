import { describe, expect, it } from 'bun:test'
import { dbMigrateScriptName, parseDbCliArgs } from '../../cli/parse-db-cli'

describe('parseDbCliArgs', () => {
  it('parses migrate commands', () => {
    expect(parseDbCliArgs(['migrate', 'local'])).toEqual({
      kind: 'migrate',
      target: 'local',
      slice: 'full',
    })
    expect(parseDbCliArgs(['migrate', 'staging', '--auth'])).toEqual({
      kind: 'migrate',
      target: 'staging',
      slice: 'auth',
    })
    expect(parseDbCliArgs(['migrate', 'staging', '--school'])).toEqual({
      kind: 'migrate',
      target: 'staging',
      slice: 'school',
    })
  })

  it('parses generate and browser', () => {
    expect(parseDbCliArgs(['generate', '--auth'])).toEqual({
      kind: 'generate',
      auth: true,
    })
    expect(parseDbCliArgs(['browser', 'school'])).toEqual({
      kind: 'browser',
      target: 'school',
    })
  })

  it('maps migrate scripts', () => {
    expect(dbMigrateScriptName('production', 'school')).toBe('migrate:production:school')
  })
})
