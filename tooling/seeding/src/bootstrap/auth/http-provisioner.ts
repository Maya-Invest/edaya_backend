/* eslint-disable dot-notation -- Process environment uses an index signature. */
import type { AuthAccountInput, AuthProvisioner, EnsureUserOptions } from '../../support/types'
import type { HttpSeedClient } from '../../transport/http/client'
import { readFileSync } from 'node:fs'
import process from 'node:process'

const sessions = new WeakMap<HttpSeedClient, Map<string, { cookie: string, subjectId: string }>>()

/** Local fixtures exercise OTP. Remote seeding requires operator-authenticated sessions, including MFA. */
export async function signInSeedAccount(client: HttpSeedClient, email: string): Promise<{ subjectId: string }> {
  const cache = sessions.get(client) ?? new Map<string, { cookie: string, subjectId: string }>()
  sessions.set(client, cache)
  const existing = cache.get(email)
  if (existing) {
    client.clearCookies()
    for (const pair of existing.cookie.split('; ')) client.absorbCookies(new Response(null, { headers: { 'set-cookie': pair } }))
    return { subjectId: existing.subjectId }
  }
  const identityUrl = new URL(client.identityOrigin)
  const host = identityUrl.hostname
  const file = process.env['SEED_AUTH_SESSIONS_FILE']
  let response: Response
  if (file || !['localhost', '127.0.0.1', '[::1]'].includes(host)) {
    if (!file)
      throw new Error('Remote passwordless seeding requires SEED_AUTH_SESSIONS_FILE with operator-authenticated renewal credentials')
    const manifest = JSON.parse(readFileSync(file, 'utf8')) as Record<string, string>
    const credential = manifest[email]
    if (!credential || !/^[\w-]+$/.test(credential))
      throw new Error('Missing opaque fixture renewal credential')
    const cookieName = identityUrl.protocol === 'https:' ? '__Host-edaya_session' : 'edaya_session'
    client.absorbCookies(new Response(null, { headers: { 'set-cookie': `${cookieName}=${credential}` } }))
    response = await client.request('/auth/edaya/session', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
  }
  else {
    const termsResponse = await client.request('/auth/edaya/terms?locale=en')
    if (!termsResponse.ok)
      throw new Error(`Seed terms lookup failed (${termsResponse.status})`)
    const terms = await termsResponse.json() as { enforced: boolean, document: { version: string, locale: 'fr' | 'en', status: 'draft' | 'published' } | null }
    // Local fixtures may acknowledge preview text; published agreements require
    // an operator-authenticated session, just like remote seeding.
    if (terms.enforced && (terms.document?.status !== 'draft' || !terms.document.version || terms.document.locale !== 'en'))
      throw new Error('Local fixture OTP requires draft terms; use SEED_AUTH_SESSIONS_FILE for published terms')
    const termsAcceptance = terms.enforced && terms.document
      ? { version: terms.document.version, locale: terms.document.locale, accepted: true }
      : undefined
    const send = await client.request('/auth/edaya/otp/start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'email', value: email, channel: 'email', termsAcceptance }) })
    if (!send.ok)
      throw new Error(`Seed OTP delivery failed (${send.status})`)
    const { challenge } = await send.json() as { challenge: string }
    let otp: string
    const mailbox = process.env['EDAYA_TEST_OTP_FILE']
    if (mailbox) {
      const messages = readFileSync(mailbox, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line) as { channel: string, destination: string, code: string })
      const delivery = messages.reverse().find(message => message.channel === 'email' && message.destination === email.trim().toLowerCase())
      if (!delivery)
        throw new Error('Required seed OTP delivery missing')
      otp = delivery.code
    }
    else {
      const peek = await client.request('/auth/edaya/testing/otp', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challenge }) })
      if (!peek.ok)
        throw new Error('Local seed requires captured delivery or the unified API fixture server')
      otp = (await peek.json() as { otp: string }).otp
    }
    response = await client.request('/auth/edaya/otp/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ challenge, code: otp }) })
  }
  if (!response.ok)
    throw new Error(`Seed authentication failed (${response.status})`)
  const body = await response.json() as { user?: { id: string } }
  if (!body.user?.id)
    throw new Error('Seed authentication requires completed MFA')
  cache.set(email, { subjectId: body.user.id, cookie: client.cookieHeader() ?? '' })
  return { subjectId: body.user.id }
}
export class HttpAuthProvisioner implements AuthProvisioner {
  constructor(private readonly client: HttpSeedClient) {}
  async ensureUser(account: AuthAccountInput, options?: EnsureUserOptions): Promise<{ subjectId: string }> {
    return options?.preserveSession ? this.client.withCookieSnapshot(() => signInSeedAccount(this.client, account.email)) : signInSeedAccount(this.client, account.email)
  }

  async lookupSubjectIdByEmail(email: string, _password: string): Promise<string | undefined> { return (await signInSeedAccount(this.client, email)).subjectId }
}
export async function signInViaHttp(client: HttpSeedClient, input: { email: string, password?: string }): Promise<void> {
  await signInSeedAccount(client, input.email)
}
