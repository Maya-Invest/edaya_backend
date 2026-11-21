import type { TeacherIncidentsPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { teacherIncidentItem, teacherIncidentsPageSize } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { incidents } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

export class PostgresTeacherIncidents implements TeacherIncidentsPort {
  constructor(private readonly db: Executor) {}

  async list({ read, edit, teacherId, classGroupId, after }: Parameters<TeacherIncidentsPort['list']>[0]) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const result = await db.execute(sql`with page as (
      select id, school_id, title, description, date, kind, status from ${incidents}
      where school_id=${read.schoolId} and class_group_id=${classGroupId} and reporter_id=${teacherId}
        and ${compileResourceAccess(incidents, read)} and ${compileResourceAccess(incidents, edit)}
        ${after ? sql`and (date,id)<(${after.date}::timestamp,${after.id})` : sql``}
      order by date desc,id desc limit ${teacherIncidentsPageSize + 1}
    )
    select p.id,p.title,p.description,to_char(p.date,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as date,p.kind,p.status,
      (p.status <> 'open' or coalesce((s.payload->>'locked')::boolean,false) or exists (
        select 1 from student_disciplinary_actions a where a.school_id=p.school_id and a.incident_id=p.id
      )) as locked
    from page p left join teacher_workflow_states s on s.school_id=p.school_id and s.workflow='discipline' and s.target_id=p.id
    order by p.date desc,p.id desc`)
    return result.rows.map(row => teacherIncidentItem.parse(row))
  }
}
