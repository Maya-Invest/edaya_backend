import type { DeliveryInboxPort, ResourceAccessScope } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { deliveryInboxRow } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { messageDeliveries } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

export class PostgresDeliveryInbox implements DeliveryInboxPort {
  constructor(private readonly db: Executor) {}

  async page(scope: ResourceAccessScope, limit: number, after?: { at: string, id: string }) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const visible = sql`${compileResourceAccess(messageDeliveries, scope)} and event_key is distinct from 'conversation.message'`
    const sortAt = sql`coalesce(sent_at, created_at)`
    const key = sql`id collate "C"`
    const boundary = after ? sql`and (${sortAt}, ${key}) < (${after.at}::timestamp, ${after.id})` : sql``
    const { rows } = await db.execute(sql`
      with page as (
        select id, title, left(body, 320) as preview, status,
          to_char(${sortAt}, 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as at
        from ${messageDeliveries} where ${visible} ${boundary}
        order by ${sortAt} desc, ${key} desc limit ${limit + 1}
      )
      select (select count(*)::int from ${messageDeliveries} where ${visible} and status <> 'read') as unread,
        (select coalesce(jsonb_agg(to_jsonb(p) order by p.at desc, p.id collate "C" desc), '[]'::jsonb) from page p) as items`)
    const { items: pageRows, unread } = rows[0]!
    const all = deliveryInboxRow.array().parse(pageRows)
    const items = all.slice(0, limit)
    const last = items.at(-1)
    return { items, unreadCount: Number(unread), nextCursor: last && all.length > limit ? JSON.stringify([last.at, last.id]) : null }
  }
}
