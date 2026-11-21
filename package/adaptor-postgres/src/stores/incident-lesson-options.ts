import type { IncidentLessonOptionsInput, IncidentLessonOptionsPort, ResourceAccessScope } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { incidentLessonOption, incidentLessonOptionsPageSize } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { lessonSessions } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

export class PostgresIncidentLessonOptions implements IncidentLessonOptionsPort {
  constructor(private readonly db: Executor) {}

  async read(scope: ResourceAccessScope, input: IncidentLessonOptionsInput, after?: string) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const visible = sql`class_group_id=${input.classGroupId} and ${compileResourceAccess(lessonSessions, scope)}`
    const startsAt = sql`to_char(starts_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
    const fields = sql`select id, display_label as "displayLabel", ${startsAt} as "startsAt" from ${lessonSessions}`
    const result = await db.execute(sql`${fields} where ${visible}
      ${after ? sql`and id > ${after}` : sql``}
      ${input.q ? sql`and strpos(lower(concat_ws(' · ',display_label,${startsAt})),lower(${input.q})) > 0` : sql``}
      order by id limit ${incidentLessonOptionsPageSize + 1}`)
    const items = result.rows.map(row => incidentLessonOption.parse(row))
    let selected = items.find(row => row.id === input.selectedId) ?? null
    if (!selected && input.selectedId) {
      const found = await db.execute(sql`${fields} where id=${input.selectedId} and ${visible}`)
      selected = found.rows.length ? incidentLessonOption.parse(found.rows[0]) : null
    }
    return { items, selected }
  }
}
