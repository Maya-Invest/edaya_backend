import type { Account, AccountRepositoryPort, AccountSecurity, AuthChallenge, AuthSession, DeliveryReceipt, IdentifierKind, PendingAuth, RecipientCooldown } from '@edaya/account'
import type { SQL } from 'drizzle-orm'
import { AsyncLocalStorage } from 'node:async_hooks'
import { sql } from 'drizzle-orm'

export interface AccountDatabase {
  execute: (query: SQL) => Promise<unknown>
  transaction: <T>(work: (tx: AccountDatabase) => Promise<T>) => Promise<T>
}
export function rows<T>(result: unknown): T[] {
  if (Array.isArray(result))
    return result as T[]
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return result.rows as T[]
  throw new Error('Unsupported account database result')
}
/** Shares the provider transaction so OTP consumption and identity resolution commit together. */
export function createAccountRepository(database: unknown, clock: () => number = Date.now): {
  repository: AccountRepositoryPort
  db: AccountDatabase
} {
  const root = database as AccountDatabase
  const context = new AsyncLocalStorage<AccountDatabase>()
  const db = new Proxy(root, { get(_target, key) {
    const active = context.getStore() ?? root
    if (key === 'transaction')
      return <T>(work: (tx: AccountDatabase) => Promise<T>) => context.getStore() ? work(active) : root.transaction(work)
    const value = Reflect.get(active, key)
    return typeof value === 'function' ? value.bind(active) : value
  } })
  async function query<T>(statement: SQL): Promise<T[]> {
    return rows<T>(await db.execute(statement))
  }
  async function get(id: string): Promise<Account | null> {
    const [record] = await query<{
      id: string
      status: Account['status']
      name: string
      security_version: number
      created_at: number
    }>(sql`SELECT * FROM identity.account WHERE id=${id}`)
    if (!record)
      return null
    const identifiers = await query<{
      id: string
      kind: IdentifierKind
      value: string
      verified_at: number
      recovery_eligible: boolean
    }>(sql`SELECT * FROM identity.identifier WHERE account_id=${id} AND revoked_at IS NULL ORDER BY verified_at, id`)
    return { id: record.id, status: record.status, name: record.name, securityVersion: record.security_version, createdAt: Number(record.created_at), identifiers: identifiers.map(i => ({ id: i.id, kind: i.kind, value: i.value, verifiedAt: Number(i.verified_at), recoveryEligible: i.recovery_eligible })),
    }
  }
  const repository: AccountRepositoryPort = {
    async saveTermsAcceptance(acceptance) {
      await db.execute(sql`INSERT INTO identity.terms_acceptance (account_id,version,locale,document_hash,accepted_at) VALUES (${acceptance.accountId},${acceptance.version},${acceptance.locale},${acceptance.documentHash},${acceptance.acceptedAt}) ON CONFLICT (account_id,version) DO NOTHING`)
    },
    async transaction(work) {
      if (context.getStore())
        return work()
      return root.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '5s'`)
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('edaya:account-auth',0))`)
        return context.run(tx, work)
      })
    },
    get,
    async find(kind, value) {
      const [row] = await query<{
        account_id: string
      }>(sql`SELECT account_id FROM identity.identifier WHERE kind=${kind} AND value=${value} AND revoked_at IS NULL`)
      return row ? get(row.account_id) : null
    },
    async save(account) {
      await db.execute(sql`INSERT INTO identity.account (id,status,name,security_version,created_at) VALUES (${account.id},${account.status},${account.name},${account.securityVersion},${account.createdAt}) ON CONFLICT (id) DO UPDATE SET status=excluded.status,name=excluded.name,security_version=excluded.security_version`)
      const ids = account.identifiers.map(i => i.id)
      if (ids.length)
        await db.execute(sql`UPDATE identity.identifier SET revoked_at=${Date.now()} WHERE account_id=${account.id} AND revoked_at IS NULL AND id NOT IN (${sql.join(ids.map(id => sql`${id}`), sql`,`)})`)
      else
        await db.execute(sql`UPDATE identity.identifier SET revoked_at=${Date.now()} WHERE account_id=${account.id} AND revoked_at IS NULL`)
      for (const i of account.identifiers)
        await db.execute(sql`INSERT INTO identity.identifier (id,account_id,kind,value,verified_at,recovery_eligible) VALUES (${i.id},${account.id},${i.kind},${i.value},${i.verifiedAt},${i.recoveryEligible}) ON CONFLICT (id) DO UPDATE SET recovery_eligible=excluded.recovery_eligible`)
    },
    async security(id) {
      return (await query<{
        data: AccountSecurity
      }>(sql`SELECT data FROM identity.security WHERE account_id=${id}`))[0]?.data ?? { recoveryHashes: [],
      }
    },
    async saveSecurity(id, security) { await db.execute(sql`INSERT INTO identity.security (account_id,data) VALUES (${id},${JSON.stringify(security)}::jsonb) ON CONFLICT (account_id) DO UPDATE SET data=excluded.data`) },
    async challenge(id) {
      return (await query<{
        data: AuthChallenge
      }>(sql`SELECT data FROM identity.challenge WHERE id=${id}`))[0]?.data ?? null
    },
    async saveChallenge(c) { await db.execute(sql`INSERT INTO identity.challenge (id,kind,value,expires_at,data) VALUES (${c.id},${c.kind},${c.value},${c.expiresAt},${JSON.stringify(c)}::jsonb) ON CONFLICT (id) DO UPDATE SET data=excluded.data`) },
    async challengeAttempts(kind, value, now) {
      const records = await query<{ data: AuthChallenge }>(sql`SELECT data FROM identity.challenge WHERE kind=${kind} AND value=${value} AND expires_at>${now}`)
      return Math.max(0, ...records.map(r => r.data.attempts))
    },
    async challengeByMessage(messageId) {
      return (await query<{ data: AuthChallenge }>(sql`SELECT data FROM identity.challenge WHERE data->>'messageId'=${messageId} AND expires_at > ${clock() - 3600000} LIMIT 1`))[0]?.data ?? null
    },
    async supersede(kind, value, now = Date.now()) {
      const records = await query<{
        data: AuthChallenge
      }>(sql`SELECT data FROM identity.challenge WHERE kind=${kind} AND value=${value} AND expires_at>${now - 3600000}`)
      for (const { data } of records) {
        data.consumed = true
        data.superseded = true
        await repository.saveChallenge(data)
      }
      return Math.max(0, ...records.filter(r => r.data.expiresAt > now).map(r => r.data.attempts))
    },
    async cooldown(value) {
      return (await query<{ data: RecipientCooldown }>(sql`SELECT data FROM identity.otp_cooldown WHERE value=${value} AND expires_at > ${clock()}`))[0]?.data ?? null
    },
    async saveCooldown(value, data) {
      await db.execute(sql`INSERT INTO identity.otp_cooldown (value,expires_at,data) VALUES (${value},${data.lastSentAt + 3600000},${JSON.stringify(data)}::jsonb) ON CONFLICT (value) DO UPDATE SET expires_at=excluded.expires_at,data=excluded.data`)
    },
    async deliveryRequest(id) {
      return (await query<{ fingerprint: string, challenge: string }>(sql`SELECT fingerprint,challenge FROM identity.otp_request WHERE id=${id} AND expires_at > ${clock()}`))[0] ?? null
    },
    async saveDeliveryRequest(id, fingerprint, challenge, expiresAt) {
      const saved = await query(sql`INSERT INTO identity.otp_request (id,fingerprint,challenge,expires_at)
        VALUES (${id},${fingerprint},${challenge},${expiresAt})
        ON CONFLICT (id) DO UPDATE SET fingerprint=excluded.fingerprint, challenge=excluded.challenge, expires_at=excluded.expires_at
        WHERE identity.otp_request.expires_at <= ${clock()} RETURNING id`)
      if (!saved.length)
        throw new Error('OTP delivery request already exists')
    },
    async receipts(messageId) {
      return (await query<{ data: DeliveryReceipt }>(sql`SELECT data FROM identity.otp_receipt WHERE message_id=${messageId} AND expires_at > ${clock()}`)).map(r => r.data)
    },
    async saveReceipt(receipt, expiresAt) {
      return (await query(sql`INSERT INTO identity.otp_receipt (id,message_id,expires_at,data) VALUES (${receipt.id},${receipt.messageId},${expiresAt},${JSON.stringify(receipt)}::jsonb) ON CONFLICT (id) DO UPDATE SET message_id=excluded.message_id, expires_at=excluded.expires_at, data=excluded.data
        WHERE identity.otp_receipt.expires_at <= ${clock()} RETURNING id`)).length > 0
    },
    async reserveSendQuota(ip, recipient, now, fixtures) {
      const limits = [{ key: `send:ip:${ip}`, maximum: fixtures ? 10000 : 20, seconds: 600 }, { key: `send:recipient:phone:${recipient}`, maximum: fixtures ? 10000 : 5, seconds: 3600 }]
      for (const limit of limits) {
        const [record] = await query<{ count: number, expires_at: number }>(sql`SELECT count,expires_at FROM identity.quota WHERE key=${limit.key}`)
        if (record && Number(record.expires_at) > now && record.count >= limit.maximum)
          return false
      }
      for (const limit of limits)
        await repository.quota(limit.key, limit.maximum, limit.seconds, now)
      return true
    },
    async resetChallengeAttempts(kind, value) {
      await db.execute(sql`UPDATE identity.challenge SET data=jsonb_set(data,'{attempts}','0'::jsonb) WHERE kind=${kind} AND value=${value}`)
    },
    async pending(digest) {
      return (await query<{
        data: PendingAuth
      }>(sql`SELECT data FROM identity.pending WHERE digest=${digest}`))[0]?.data ?? null
    },
    async savePending(p) { await db.execute(sql`INSERT INTO identity.pending (digest,account_id,expires_at,data) VALUES (${p.digest},${p.accountId},${p.expiresAt},${JSON.stringify(p)}::jsonb) ON CONFLICT (digest) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at`) },
    async deletePending(digest) { await db.execute(sql`DELETE FROM identity.pending WHERE digest=${digest}`) },
    async session(digest) {
      return (await query<{
        data: AuthSession
      }>(sql`SELECT data FROM identity.session WHERE digest=${digest}`))[0]?.data ?? null
    },
    async saveSession(s) { await db.execute(sql`INSERT INTO identity.session (digest,account_id,expires_at,data) VALUES (${s.digest},${s.accountId},${s.expiresAt},${JSON.stringify(s)}::jsonb)`) },
    async revoke(id, digest) { await db.execute(digest ? sql`DELETE FROM identity.session WHERE account_id=${id} AND digest=${digest}` : sql`DELETE FROM identity.session WHERE account_id=${id}`) },
    async quota(key, maximum, seconds, now) {
      const [row] = await query<{
        count: number
      }>(sql`INSERT INTO identity.quota (key,count,expires_at) VALUES (${key},1,${now + seconds * 1000}) ON CONFLICT (key) DO UPDATE SET count=CASE WHEN identity.quota.expires_at<=${now} THEN 1 ELSE identity.quota.count+1 END, expires_at=CASE WHEN identity.quota.expires_at<=${now} THEN excluded.expires_at ELSE identity.quota.expires_at END RETURNING count`)
      return !!row && row.count <= maximum
    },
    async mappedAccount(e) {
      return (await query<{
        account_id: string
      }>(sql`SELECT account_id FROM identity.provider_link WHERE provider=${e.provider} AND subject=${e.subject}`))[0]?.account_id ?? null
    },
    async unlinkProvider(kind, value) { await db.execute(sql`DELETE FROM identity.provider_link WHERE kind=${kind} AND value=${value}`) },
    async linkProvider(e, accountId) {
      const mapped = await repository.mappedAccount(e)
      if (mapped && mapped !== accountId)
        throw new Error('Provider identity already belongs to another Account')
      await db.execute(sql`INSERT INTO identity.provider_link (provider,subject,account_id,kind,value) VALUES (${e.provider},${e.subject},${accountId},${e.kind},${e.value}) ON CONFLICT (provider,subject) DO NOTHING`)
    },
    async audit(id, event, now) { await db.execute(sql`INSERT INTO identity.security_event (account_id,event,created_at) VALUES (${id},${event},${now})`) },

  }
  return { repository, db,
  }
}
