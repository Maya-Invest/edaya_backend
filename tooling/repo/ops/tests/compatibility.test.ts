import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from 'bun:test'
import { lastSuccessfulDeployment } from '../compatibility'
import { run } from '../runtime'
import { tool } from '../tools'

test('pinned compatibility gate permits additive routes and rejects changed response schemas', async () => {
  const directory = mkdtempSync(resolve(tmpdir(), 'edaya-contract-'))
  const contract = { openapi: '3.0.3', info: { title: 'Regression', version: '1' }, paths: { '/school': { get: { operationId: 'getSchool', responses: { 200: { description: 'School', content: { 'application/json': { schema: { type: 'object', required: ['id'], properties: { id: { type: 'string' } } } } } } } } } } }
  try {
    const old = resolve(directory, 'old.json')
    const next = resolve(directory, 'new.json')
    writeFileSync(old, JSON.stringify(contract))
    writeFileSync(next, JSON.stringify({ ...contract, paths: { ...contract.paths, '/extra': contract.paths['/school'] } }))
    const binary = await tool('oasdiff')
    await run([binary, 'breaking', old, next, '--fail-on', 'WARN'], { quiet: true })
    const changed = structuredClone(contract)
    changed.paths['/school'].get.responses[200].content['application/json'].schema.properties.id.type = 'integer'
    writeFileSync(next, JSON.stringify(changed))
    await expect(run([binary, 'breaking', old, next, '--fail-on', 'WARN'], { quiet: true })).rejects.toThrow()
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
