import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { checkContract, lastSuccessfulDeployment } from '../compatibility'
import { run } from '../runtime'

test('historical schema changes are reported while current behavior remains mandatory', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-contract-'))
  const contract = { openapi: '3.0.3', info: { title: 'Regression', version: '1' }, paths: { '/school': { get: { operationId: 'getSchool', responses: { 200: { description: 'School', content: { 'application/json': { schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } } } } } } } }
  try {
    const old = resolve(directory, 'old.json')
    const next = resolve(directory, 'new.json')
    writeFileSync(old, JSON.stringify(contract))
    writeFileSync(next, JSON.stringify({ ...contract, paths: { ...contract.paths, '/extra': contract.paths['/school'] } }))
    const report = resolve(directory, 'report.json')
    let behaviorRuns = 0
    const execute: typeof run = async (command, options) => {
      if (command[0] !== 'bun')
        return run(command, options)
      expect(command).toContain('src/compatibility')
      expect(command).toContain('src/auth/production-session-actor.integration.test.ts')
      expect(command).toContain('src/routes/test-school-repository-scope.integration.test.ts')
      behaviorRuns++
      return ''
    }
    await checkContract(old, next, report, execute)
    expect(JSON.parse(readFileSync(report, 'utf8')).changes).toEqual([])
    const changed = structuredClone(contract)
    changed.paths['/school'].get.responses[200].content['application/json'].schema.properties.id.type = 'integer'
    writeFileSync(next, JSON.stringify(changed))
    await checkContract(old, next, report, execute)
    const evidence = JSON.parse(readFileSync(report, 'utf8'))
    expect(evidence.policy).toBe('clients-upgrade-with-backend')
    expect(evidence.blocking).toBe(false)
    expect(evidence.changes.length).toBeGreaterThan(0)
    expect(behaviorRuns).toBe(2)

    await expect(checkContract(old, next, report, async (command, options) => {
      if (command[0] === 'bun')
        throw new Error('Behavioral regression')
      return run(command, options)
    })).rejects.toThrow('Behavioral regression')
    // Preserve the upgrade report even when regression tests fail.
    expect(JSON.parse(readFileSync(report, 'utf8'))).toEqual(evidence)

    writeFileSync(next, 'invalid OpenAPI document')
    await expect(checkContract(old, next, report, execute)).rejects.toThrow()
    expect(existsSync(report)).toBe(false)
    expect(behaviorRuns).toBe(2)
    await expect(checkContract(old, resolve(directory, 'missing.json'), report, execute)).rejects.toThrow()
  }
  finally {
    rmSync(directory, { recursive: true, force: true })
  }
}, 90000)

test('release history preserves the last successful baseline across failed pages', async () => {
  const expected = 'a'.repeat(40)
  const seen: string[] = []
  const result = await lastSuccessfulDeployment('staging', async (path) => {
    seen.push(path)
    if (path.endsWith('&page=1') && path.startsWith('deployments?'))
      return Array.from({ length: 100 }, (_, id) => ({ id, sha: 'b'.repeat(40) }))
    if (path.startsWith('deployments?'))
      return [{ id: 100, sha: expected }]
    return [{ state: path.startsWith('deployments/100/') ? 'success' : 'failure' }]
  })
  expect(result).toBe(expected)
  expect(seen.some(path => path.endsWith('&page=2'))).toBe(true)
})

test('missing history permits bootstrap, but network failure blocks it', async () => {
  expect(await lastSuccessfulDeployment('production', async () => [])).toBeUndefined()
  await expect(lastSuccessfulDeployment('production', async () => {
    throw new Error('Network failed')
  })).rejects.toThrow('Network failed')
})
