import { createHash } from 'node:crypto'
import { createAccessTokenStore, createOAuthClientRegistry, hashOAuthToken, runMigrations } from '@edaya/adaptor-auth'
import { afterAll, beforeAll, expect, test } from 'bun:test'
import { sql } from 'drizzle-orm'
import { createLocalJWKSet, jwtVerify } from 'jose'
import { createBetterAuth } from '@/runtime/shared/adapters/better-auth'
import { createExternalOAuthProvider } from '@/runtime/shared/adapters/external-oauth'
import { createPostgresSchoolDatabase } from '@/runtime/shared/school-database'

const url = process.env.EDAYA_NATIVE_TEST_URL
if (!url || new URL(url).hostname !== '127.0.0.1')
  throw new Error('Use the disposable native test runner')
const handles = await Promise.all([createPostgresSchoolDatabase(url), createPostgresSchoolDatabase(url)])
const db = handles[0]!.db as { execute: (query: ReturnType<typeof sql>) => Promise<{ rows: Record<string, unknown>[] }> }
const origin = 'http://localhost:5173'
const base = 'http://localhost:9999'
const env = { NODE_ENV: 'test', LOG_LEVEL: 'silent' as const, BETTER_AUTH_URL: base, BETTER_AUTH_SECRET: 'synthetic-oauth-test-secret-at-least-32-chars', TRUSTED_ORIGINS: origin, WEBAPP_ORIGIN: origin, REQUIRE_EMAIL_VERIFICATION: false }
const selected = { schoolId: 'oauth-school', studentIds: ['oauth-child'], scopes: ['openid', 'offline_access', 'students.profile:read'] }
let current = true
const ports = {
  authorizeSelection: async (_subject: string, selection: typeof selected) => {
    if (selection.schoolId !== selected.schoolId || selection.studentIds.some(id => id !== 'oauth-child'))
      throw new Error('Synthetic unlinked child')
    return { guardianId: 'oauth-parent' }
  },
  isGrantCurrent: async () => current,
}
const providers = handles.map(handle => createExternalOAuthProvider(handle.db, env, ports))
const firstParty = createBetterAuth(handles[0]!.db, env)
let cookie: string

beforeAll(async () => {
  await runMigrations(handles[0]!.db, { driver: 'node-postgres' })
  await db.execute(sql`INSERT INTO auth.oauth_client (id, client_id, name, redirect_uris, scopes, grant_types, response_types, require_pkce, token_endpoint_auth_method, skip_consent)
    VALUES ('fixture-client', 'fixture-study-app', 'Synthetic Study App', ARRAY['http://localhost:7777/callback'],
    ARRAY['openid', 'offline_access', 'students.profile:read'], ARRAY['authorization_code', 'refresh_token'], ARRAY['code'], true, 'none', false)`)
  const signup = await firstParty.handler(new Request(`${base}/auth/sign-up/email`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify({ name: 'Synthetic parent', email: 'oauth-parent@example.test', password: 'Synthetic-parent-password-42' }),
  }))
  expect(signup.status).toBe(200)
  cookie = signup.headers.get('set-cookie')!.split(';')[0]!
})
afterAll(async () => {
  await Promise.all(handles.map(handle => handle.dispose()))
})

async function authorize() {
  const verifier = 'synthetic-pkce-verifier-with-43-or-more-characters-123456'
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const params = new URLSearchParams({ client_id: 'fixture-study-app', redirect_uri: 'http://localhost:7777/callback', scope: selected.scopes.join(' '), response_type: 'code', code_challenge_method: 'S256', code_challenge: challenge, state: 'synthetic-state', nonce: 'synthetic-nonce' })
  const response = await providers[0]!.handler(new Request(`${base}/auth/oauth2/authorize?${params}`, { headers: { cookie, accept: 'application/json' } }))
  const body = await response.json() as { url: string }
  expect(response.status).toBe(200)
  return { params, verifier, query: new URL(body.url).search.slice(1) }
}

async function consent(query: string) {
  return providers[0]!.consent(new Request(`${base}/auth/oauth2/consent`, {
    method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ accept: true, oauth_query: query, referenceId: 'forged-grant' }),
  }), selected)
}

async function token(body: Record<string, string>, instance = 0) {
  return providers[instance]!.handler(new Request(`${base}/auth/oauth2/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'fixture-study-app', ...body }),
  }))
}

async function issue() {
  const { query, verifier } = await authorize()
  const response = await consent(query)
  const body = await response.json() as { url: string }
  expect(response.status).toBe(200)
  const callback = new URL(body.url)
  expect(callback.searchParams.get('state')).toBe('synthetic-state')
  const code = callback.searchParams.get('code')!
  const exchange = await token({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'http://localhost:7777/callback' })
  const tokens = await exchange.json() as { access_token: string, refresh_token: string, id_token: string }
  expect(exchange.status).toBe(200)
  return { ...tokens, code, verifier }
}

test('real PKCE consent binds a server-created child grant, rejects code replay and revokes immediately', async () => {
  const tokens = await issue()
  expect(tokens.access_token).toMatch(/^edaya_oat_/)
  expect(tokens.refresh_token).toMatch(/^edaya_ort_/)
  expect(tokens.id_token.split('.')).toHaveLength(3)
  const grant = await providers[1]!.grants.findTokenGrant(tokens.access_token, 'access')
  expect(grant?.id).not.toBe('forged-grant')
  expect(grant?.studentIds).toEqual(['oauth-child'])
  expect(grant?.scopes).toEqual([...selected.scopes].sort())
  expect(await createAccessTokenStore(handles[1]!.db).resolve(tokens.access_token)).toBeNull()
  expect((await token({ grant_type: 'authorization_code', code: tokens.code, code_verifier: tokens.verifier, redirect_uri: 'http://localhost:7777/callback' })).status).toBeGreaterThanOrEqual(400)
  await providers[0]!.transactions.execute(() => providers[0]!.grants.revoke(grant!.id, grant!.subjectId))
  expect(await providers[1]!.grants.findTokenGrant(tokens.access_token, 'access')).toBeNull()
  expect((await token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }, 1)).status).toBe(400)
}, 20000)

test('simultaneous refresh across instances cannot rebuild a replayed token family', async () => {
  const tokens = await issue()
  const responses = await Promise.all(providers.map((_, index) => token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }, index)))
  expect(responses.map(response => response.status).sort()).toEqual([200, 400])
  const winner = await responses.find(response => response.ok)!.json() as { access_token: string, refresh_token: string }
  expect(await providers[0]!.grants.findTokenGrant(winner.access_token, 'access')).toBeNull()
  expect((await token({ grant_type: 'refresh_token', refresh_token: winner.refresh_token })).status).toBe(400)
}, 20000)

test('invalid signed consent rolls back the grant and current relationship removal denies refresh', async () => {
  const before = await db.execute(sql`SELECT count(*)::int AS count FROM auth.edaya_delegation_grants`)
  const { query } = await authorize()
  const tampered = new URLSearchParams(query)
  tampered.set('state', 'tampered-state')
  expect((await consent(tampered.toString())).status).toBeGreaterThanOrEqual(400)
  const after = await db.execute(sql`SELECT count(*)::int AS count FROM auth.edaya_delegation_grants`)
  expect(after.rows[0]!.count).toBe(before.rows[0]!.count)
  const tokens = await issue()
  current = false
  expect((await token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }, 1)).status).toBe(400)
  current = true
}, 20000)

test('wrong PKCE and redirect URI cannot exchange an authorization code', async () => {
  for (const invalid of [
    { code_verifier: 'incorrect-verifier-with-43-or-more-characters-123456' },
    { redirect_uri: 'http://localhost:7777/another-callback' },
  ]) {
    const { query, verifier } = await authorize()
    const accepted = await (await consent(query)).json() as { url: string }
    const code = new URL(accepted.url).searchParams.get('code')!
    const response = await token({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: 'http://localhost:7777/callback', ...invalid })
    expect(response.status).toBeGreaterThanOrEqual(400)
  }
}, 20000)

test('refresh scope narrowing and absolute consent expiry are enforced', async () => {
  const original = await issue()
  const grant = (await providers[0]!.grants.findTokenGrant(original.access_token, 'access'))!
  const expiresAt = new Date(Date.now() + 120000)
  await db.execute(sql`UPDATE auth.edaya_delegation_grants SET expires_at = ${expiresAt} WHERE id = ${grant.id}`)
  const refreshed = await token({ grant_type: 'refresh_token', refresh_token: original.refresh_token, scope: 'openid students.profile:read' })
  expect(refreshed.status).toBe(200)
  const result = await refreshed.json() as { access_token: string, expires_in: number, expires_at: number }
  expect(result.expires_in).toBeLessThanOrEqual(120)
  expect(result.expires_at).toBeLessThanOrEqual(Math.floor(expiresAt.getTime() / 1000))
  expect((await providers[1]!.grants.findTokenGrant(result.access_token, 'access'))?.scopes).toEqual(['openid', 'students.profile:read'])
  const excessive = await db.execute(sql`SELECT id FROM auth.oauth_refresh_token WHERE reference_id = ${grant.id} AND expires_at > ${expiresAt}`)
  expect(excessive.rows).toHaveLength(0)
  await db.execute(sql`UPDATE auth.edaya_delegation_grants SET expires_at = NOW() - INTERVAL '1 second' WHERE id = ${grant.id}`)
  expect(await providers[1]!.grants.findTokenGrant(result.access_token, 'access')).toBeNull()
}, 20000)

test('operator registry hashes secrets and rotation invalidates existing consent', async () => {
  const registry = createOAuthClientRegistry(providers[0]!.transactions.db)
  const input = { clientId: 'fixture-confidential', name: 'Fixture confidential', purpose: 'Synthetic test', redirectUris: ['http://localhost:7777/callback'], scopes: selected.scopes, confidential: true }
  const created = await providers[0]!.transactions.execute(() => registry.register(input))
  expect(created.clientSecret).toBeTruthy()
  const stored = await db.execute(sql`SELECT client_secret, require_pkce, skip_consent FROM auth.oauth_client WHERE client_id = ${input.clientId}`)
  expect(stored.rows[0]!.client_secret).toBe(hashOAuthToken(created.clientSecret!))
  expect(stored.rows[0]!.require_pkce).toBe(true)
  expect(stored.rows[0]!.skip_consent).toBe(false)
  const subject = await db.execute(sql`SELECT id FROM auth."user" WHERE email = 'oauth-parent@example.test'`)
  const grant = await providers[0]!.transactions.execute(() => providers[0]!.grants.create({
    ...selected,
    clientId: input.clientId,
    subjectId: String(subject.rows[0]!.id),
    guardianId: 'oauth-parent',
  }))
  expect(await providers[1]!.grants.findActive(grant.id)).not.toBeNull()
  const rotated = await providers[0]!.transactions.execute(() => registry.rotate(input.clientId))
  expect(rotated.clientSecret).not.toBe(created.clientSecret)
  expect(await providers[1]!.grants.findActive(grant.id)).toBeNull()
  await providers[0]!.transactions.execute(() => registry.disable(input.clientId))
  const disabled = await db.execute(sql`SELECT disabled FROM auth.oauth_client WHERE client_id = ${input.clientId}`)
  expect(disabled.rows[0]!.disabled).toBe(true)
})

test('discovery and signed ID tokens expose only minimal identity; userinfo rechecks the grant', async () => {
  const response = await providers[0]!.handler(new Request(`${base}/auth/.well-known/openid-configuration`))
  expect(response.status).toBe(200)
  const metadata = await response.json() as { issuer: string, jwks_uri: string, userinfo_endpoint: string, registration_endpoint?: string, token_endpoint_auth_methods_supported: string[] }
  expect(metadata.issuer).toBe(`${base}/auth`)
  expect(metadata.registration_endpoint).toBeUndefined()
  expect(metadata.token_endpoint_auth_methods_supported).toEqual(['none', 'client_secret_basic'])
  const tokens = await issue()
  const jwks = await (await providers[1]!.handler(new Request(metadata.jwks_uri))).json() as Parameters<typeof createLocalJWKSet>[0]
  const key = createLocalJWKSet(jwks)
  const options = { issuer: metadata.issuer, audience: 'fixture-study-app', algorithms: ['EdDSA'] }
  const { payload } = await jwtVerify(tokens.id_token, key, options)
  expect(payload.nonce).toBe('synthetic-nonce')
  expect(payload.exp! - payload.iat!).toBe(300)
  expect(Object.keys(payload).every(claim => ['sub', 'iss', 'aud', 'exp', 'iat', 'nonce', 'auth_time', 'acr', 'at_hash'].includes(claim))).toBe(true)
  await expect(jwtVerify(tokens.id_token, key, { ...options, issuer: 'https://wrong.example/auth' })).rejects.toThrow()
  await expect(jwtVerify(tokens.id_token, key, { ...options, audience: 'another-client' })).rejects.toThrow()
  const userinfo = (authorization: string) => providers[1]!.handler(new Request(metadata.userinfo_endpoint, { headers: { authorization, cookie } }))
  expect(await (await userinfo(`Bearer ${tokens.access_token}`)).json() as unknown).toEqual({ sub: payload.sub })
  expect((await userinfo(`Bearer ${tokens.id_token}`)).status).toBe(401)
  current = false
  try {
    expect((await userinfo(`Bearer ${tokens.access_token}`)).status).toBe(401)
  }
  finally { current = true }
  const grant = (await providers[0]!.grants.findTokenGrant(tokens.access_token, 'access'))!
  const access = await createAccessTokenStore(handles[0]!.db).issue((await db.execute(sql`SELECT id FROM auth.session WHERE user_id = ${grant.subjectId} LIMIT 1`)).rows[0]!.id as string)
  const revoked = await firstParty.handler(new Request(`${base}/auth/edaya/connected-apps/${grant.id}/revoke`, {
    method: 'POST',
    headers: { 'authorization': `Bearer ${access!.accessToken}`, 'content-type': 'application/json' },
    body: '{}',
  }))
  expect(revoked.status).toBe(200)
  expect((await userinfo(`Bearer ${tokens.access_token}`)).status).toBe(401)
  expect((await token({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token }, 1)).status).toBe(400)
}, 20000)

test('hosted consent rejects cross-origin and mixed credentials; silent authorization never reuses children', async () => {
  const { query, params } = await authorize()
  const rejectedHeaders: Record<string, string>[] = [{ origin: 'https://untrusted.example' }, { authorization: 'Bearer invalid' }]
  for (const headers of rejectedHeaders) {
    const response = await providers[0]!.consent(new Request(`${base}/auth/oauth2/consent`, {
      method: 'POST',
      headers: { origin, cookie, 'content-type': 'application/json', ...headers },
      body: JSON.stringify({ accept: true, oauth_query: query }),
    }), selected)
    expect(response.status).toBe(403)
  }
  params.set('prompt', 'none')
  const silent = await providers[0]!.handler(new Request(`${base}/auth/oauth2/authorize?${params}`, { headers: { cookie, accept: 'application/json' } }))
  const body = await silent.json() as { url: string }
  expect(new URL(body.url).searchParams.get('error')).toBe('interaction_required')
  expect(new URL(body.url).searchParams.has('code')).toBe(false)
}, 20000)

test('denied consent creates no grant or authorization code', async () => {
  const { query } = await authorize()
  const before = await db.execute(sql`SELECT count(*)::int AS count FROM auth.edaya_delegation_grants`)
  const denied = await providers[0]!.consent(new Request(`${base}/auth/oauth2/consent`, {
    method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ accept: false, oauth_query: query }),
  }), selected)
  expect(denied.status).toBe(200)
  const callback = new URL((await denied.json() as { url: string }).url)
  expect(callback.searchParams.get('error')).toBe('access_denied')
  expect(callback.searchParams.has('code')).toBe(false)
  const after = await db.execute(sql`SELECT count(*)::int AS count FROM auth.edaya_delegation_grants`)
  expect(after.rows[0]!.count).toBe(before.rows[0]!.count)
}, 20000)

test('ordinary logout preserves partner consent and security logout-all revokes it', async () => {
  const original = await issue()
  const grant = (await providers[0]!.grants.findTokenGrant(original.access_token, 'access'))!
  const logout = await firstParty.handler(new Request(`${base}/auth/sign-out`, {
    method: 'POST',
    headers: { origin, cookie, 'content-type': 'application/json' },
    body: '{}',
  }))
  expect(logout.status).toBe(200)
  const refresh = await token({ grant_type: 'refresh_token', refresh_token: original.refresh_token })
  expect(refresh.status).toBe(200)
  const refreshed = await refresh.json() as { access_token: string, refresh_token: string }
  const identity = await providers[1]!.handler(new Request(`${base}/auth/oauth2/userinfo`, { headers: { authorization: `Bearer ${refreshed.access_token}` } }))
  expect(identity.status).toBe(200)
  await createAccessTokenStore(handles[0]!.db).revokeSubjectSessions(grant.subjectId)
  expect(await providers[1]!.grants.findActive(grant.id)).toBeNull()
  expect((await token({ grant_type: 'refresh_token', refresh_token: refreshed.refresh_token }, 1)).status).toBe(400)
}, 20000)
