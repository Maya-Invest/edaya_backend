import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { apiRoot, configKeys, databaseKeys, localOnlyKeys, parseJsonc, readConfig, validateConfig } from '../../../apps/api/configuration/index.mjs'

export function workerTarget(target, root = apiRoot) {
  if (!['staging', 'production'].includes(target))
    throw new Error('Expected staging or production')
  const wrangler = parseJsonc(readFileSync(resolve(root, 'wrangler.jsonc'), 'utf8'), 'wrangler.jsonc')
  const name = wrangler.env?.[target === 'production' ? 'prod' : target]?.name
  if (typeof name !== 'string' || !/^[\w-]+$/.test(name))
    throw new Error('Missing explicit Worker name in Wrangler configuration')
  return name
}

export function planVariableUpdate(bindings, values = {}, deletes = [], replaceSecrets = [], versionId) {
  validateConfig(values, 'Worker variables', 'staging')
  const replacements = new Set(replaceSecrets)
  for (const name of replacements) {
    if (!configKeys.has(name) || databaseKeys.has(name) || localOnlyKeys.has(name) || !(name in values))
      throw new Error(`${name}: secret conversion requires a supplied, classified non-secret Worker setting`)
  }
  if (!Array.isArray(bindings) || bindings.some(b => !b || typeof b.name !== 'string' || typeof b.type !== 'string'))
    throw new Error('Invalid deployed bindings response')
  if (new Set(bindings.map(b => b.name)).size !== bindings.length)
    throw new Error('Duplicate deployed bindings')
  const byName = new Map(bindings.map(binding => [binding.name, binding]))
  const changes = []
  for (const [name, text] of Object.entries(values)) {
    const old = byName.get(name)
    if (old && !['plain_text', 'json'].includes(old.type)) {
      if (old.type !== 'secret_text' || !replacements.has(name))
        throw new Error(`${name}: collides with a ${old.type} binding; explicit secret conversion is required for legacy non-secret settings`)
    }
    if (!old || old.type !== 'plain_text' || old.text !== text)
      changes.push({ name, action: old ? 'update' : 'add' })
  }
  for (const name of deletes) {
    if (!/^[A-Z][A-Z0-9_]*$/.test(name))
      throw new Error('Invalid variable name')
    if (name in values)
      throw new Error(`${name}: cannot update and delete together`)
    const old = byName.get(name)
    if (old && !['plain_text', 'json'].includes(old.type))
      throw new Error(`${name}: only non-secret variables can be deleted`)
    if (old)
      changes.push({ name, action: 'delete' })
  }
  const changed = new Set(changes.map(change => change.name))
  const removed = new Set(deletes)
  const result = bindings.filter(b => !removed.has(b.name)).map(binding => changed.has(binding.name)
    ? { name: binding.name, type: 'plain_text', text: values[binding.name] }
    : { name: binding.name, type: 'inherit', ...(versionId ? { version_id: versionId } : {}) })
  for (const [name, text] of Object.entries(values)) {
    if (!byName.has(name))
      result.push({ name, type: 'plain_text', text })
  }
  return { changes, bindings: result }
}

function stable(value) {
  if (Array.isArray(value))
    return JSON.stringify(value.map(item => stable(item)))
  if (value && typeof value === 'object')
    return JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, stable(item)])))
  return JSON.stringify(value)
}

function activeVersion(result) {
  const deployment = result?.deployments?.[0]
  if (!deployment?.id || deployment.versions?.length !== 1 || deployment.versions[0].percentage !== 100)
    throw new Error('Variable updates require an existing Worker with one version receiving 100% of traffic')
  return { deploymentId: deployment.id, versionId: deployment.versions[0].version_id }
}

export function workerCloudClient({ accountId, token, worker, request = fetch }) {
  if (!/^[a-f0-9]{32}$/i.test(accountId ?? '') || !token)
    throw new Error('Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN (Workers Scripts Write)')
  if (!/^[\w-]+$/.test(worker ?? ''))
    throw new Error('Invalid Worker name')
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${worker}`
  async function cloud(path, init = {}) {
    let response
    try {
      response = await request(`${base}${path}`, { ...init, headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000) })
    }
    catch { throw new Error(`Cloudflare ${init.method ?? 'GET'} ${path}: network request failed`) }
    let body
    try {
      body = await response.json()
    }
    catch { throw new Error(`Cloudflare ${path}: invalid response (${response.status})`) }
    if (!response.ok || !body.success)
      throw new Error(`Cloudflare ${init.method ?? 'GET'} ${path} failed (${response.status}); check Worker existence and token permissions`)
    return body.result
  }
  return cloud
}

export async function readWorkerState(options) {
  const cloud = workerCloudClient(options)
  const deployments = await cloud('/deployments')
  const versions = await cloud('/versions')
  const settings = await cloud('/settings')
  return { deployments, versions, bindings: settings.bindings }
}

/** Settings-only update. Secrets are preserved with inherit bindings, never read back. */
export async function updateWorkerVariables(options) {
  const { accountId, token, worker, values = {}, deletes = [], replaceSecrets = [], dryRun = false, request = fetch } = options
  const cloud = workerCloudClient({ accountId, token, worker, request })
  const deployment = activeVersion(await cloud('/deployments'))
  const versions = await cloud('/versions')
  if (versions?.items?.[0]?.id !== deployment.versionId)
    throw new Error('Latest Worker version is not the active version; resolve the pending deployment before changing variables')
  const before = await cloud('/settings')
  const plan = planVariableUpdate(before.bindings, values, deletes, replaceSecrets, deployment.versionId)
  if (dryRun || !plan.changes.length)
    return { worker, ...plan, applied: false }
  // Optimistic concurrency: abort if another release or settings update has occurred.
  const current = activeVersion(await cloud('/deployments'))
  const latest = await cloud('/versions')
  const fresh = await cloud('/settings')
  if (current.deploymentId !== deployment.deploymentId || latest?.items?.[0]?.id !== deployment.versionId || stable(fresh.bindings) !== stable(before.bindings))
    throw new Error('Worker configuration changed during this operation; retry after the other deployment completes')
  const form = new FormData()
  form.set('settings', JSON.stringify({ bindings: plan.bindings }))
  await cloud('/settings', { method: 'PATCH', body: form })
  const after = await cloud('/settings')
  const actual = new Map((after.bindings ?? []).map(binding => [binding.name, binding]))
  for (const [name, text] of Object.entries(values)) {
    const binding = actual.get(name)
    if (binding?.type !== 'plain_text' || binding.text !== text)
      throw new Error(`${name}: update sent but read-back verification failed`)
  }
  for (const name of deletes) {
    if (actual.has(name))
      throw new Error(`${name}: deletion read-back verification failed`)
  }
  for (const binding of before.bindings) {
    if (binding.name in values || deletes.includes(binding.name))
      continue
    if (stable(actual.get(binding.name)) !== stable(binding))
      throw new Error(`${binding.name}: preserved binding verification failed`)
  }
  return { worker, ...plan, applied: true }
}

export function selectedVariables(target, root = apiRoot) {
  return readConfig(target, root)
}
