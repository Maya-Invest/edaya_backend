import type { ActivityMembershipCounts, ResourceAccessScope } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { inArray, sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { activityEnrollments } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

export class PostgresActivityMembershipCounts implements ActivityMembershipCounts {
  constructor(private readonly db: Executor) {}

  async forActivities(scope: ResourceAccessScope, activityIds: string[]) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const counts = new Map<string, number>()
    // Keep one bind per ID well below the PostgreSQL parameter limit, even for a full export.
    for (let i = 0; i < activityIds.length; i += 1000) {
      const ids = activityIds.slice(i, i + 1000)
      const rows = await db.execute(sql`select activity_id, count(*) as total from ${activityEnrollments}
        where ${inArray(activityEnrollments.activityId, ids)} and ${compileResourceAccess(activityEnrollments, scope)}
        group by activity_id`)
      for (const { activity_id: activityId, total } of rows.rows)
        counts.set(String(activityId), Number(total))
    }
    return counts
  }
}
