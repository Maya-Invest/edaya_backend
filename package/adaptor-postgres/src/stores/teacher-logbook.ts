import type { TeacherLogbookInput, TeacherLogbookPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { teacherLogbookItem, teacherLogbookPageSize } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

// Dart String.trim treats Unicode White_Space and BOM as blank in a raw session note.
const whitespace = ' \t\n\r\v\f\u0085\u00A0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF'

export class PostgresTeacherLogbook implements TeacherLogbookPort {
  constructor(private readonly db: Executor) {}

  async list(schoolId: string, input: TeacherLogbookInput, after?: { startsAt: string, id: string }) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const recorded = sql`(nullif(btrim(l.session_note,${whitespace}),'') is not null or exists (
      select 1 from class_subject_progress p join class_subject_matters m on m.id=p.class_subject_matter_id
      where p.lesson_session_id=l.id and m.class_subject_id=l.class_subject_id
    ))`
    const result = await db.execute(sql`select l.id, l.display_label as "displayLabel",
      to_char(l.starts_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "startsAt",
      ${input.view === 'recorded' ? sql`true` : recorded} as recorded
      from lesson_sessions l where l.school_id=${schoolId} and l.class_group_id=${input.classGroupId} and l.class_subject_id=${input.classSubjectId}
      ${input.view === 'recorded' ? sql`and ${recorded}` : sql``}
      ${after ? sql`and (l.starts_at,l.id)<(${after.startsAt}::timestamp,${after.id})` : sql``}
      order by l.starts_at desc,l.id desc limit ${teacherLogbookPageSize + 1}`)
    return result.rows.map(row => teacherLogbookItem.parse(row))
  }
}
