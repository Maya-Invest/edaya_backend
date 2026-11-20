import type { StaffFeedbackOptionScopes, StaffFeedbackOptionsInput, StaffFeedbackOptionsPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { feedbackAssignmentChoice, feedbackModeratorChoice } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import * as tables from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
const pageSize = 50

export function visibleFeedbackLabels(scopes: StaffFeedbackOptionScopes, resource: keyof StaffFeedbackOptionScopes) {
  const table = tables[resource]
  const scope = scopes[resource]
  return sql`select * from ${table} where ${scope ? compileResourceAccess(table, scope) : sql`false`}`
}

export class PostgresStaffFeedbackOptions implements StaffFeedbackOptionsPort {
  constructor(private readonly db: Executor) {}

  async page(schoolId: string, input: StaffFeedbackOptionsInput, scopes: StaffFeedbackOptionScopes) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const query = input.q?.trim()
    const visible = (resource: keyof StaffFeedbackOptionScopes) => visibleFeedbackLabels(scopes, resource)
    const assignments = async () => {
      if (input.picker === 'moderators' || !scopes.teacherAssignments)
        return []
      const result = await db.execute(sql`with assignments as (
        select * from (${visible('teacherAssignments')}) a
        where a.academic_year_id=${input.academicYearId} and a.kind='subject' and a.status='active' and a.class_subject_id is not null
        ${input.after ? sql`and a.id > ${input.after}` : sql``}
        ${query ? sql`` : sql`order by a.id limit ${pageSize + 1}`}
      )
      select a.id, btrim(t.first_name||' '||t.last_name) as "teacherName", s.name as "subjectName",
        coalesce(a.class_group_id,o.class_group_id) as "classGroupId"
      from assignments a
      left join (${visible('teachers')}) t on t.id=a.teacher_id
      left join (${visible('classSubjects')}) o on o.id=a.class_subject_id
      left join (${visible('subjects')}) s on s.id=o.subject_id
      ${query
        ? sql`left join (${visible('classGroups')}) g on g.id=coalesce(a.class_group_id,o.class_group_id)
        where strpos(lower(concat_ws(' · ',btrim(t.first_name||' '||t.last_name),s.name,g.name)),lower(${query}))>0
          or strpos(lower(a.id),lower(${query}))>0`
        : sql``}
      order by a.id limit ${pageSize + 1}`)
      return result.rows.map(row => feedbackAssignmentChoice.parse(row))
    }
    const moderators = async () => {
      if (input.picker === 'assignments' || !scopes.staffMembers)
        return []
      const result = await db.execute(sql`select m.id, m.first_name||' '||m.last_name as name from (${visible('staffMembers')}) m
        where m.school_id=${schoolId} and m.account_kind='human' and m.is_active
        ${input.after ? sql`and m.id > ${input.after}` : sql``}
        ${query ? sql`and strpos(lower(m.first_name||' '||m.last_name),lower(${query}))>0` : sql``}
        order by m.id limit ${pageSize + 1}`)
      return result.rows.map(row => feedbackModeratorChoice.parse(row))
    }
    const [assignmentRows, moderatorRows] = await Promise.all([assignments(), moderators()])
    return {
      assignments: assignmentRows.slice(0, pageSize),
      moderators: moderatorRows.slice(0, pageSize),
      nextAssignment: assignmentRows.length > pageSize ? assignmentRows[pageSize - 1]!.id : null,
      nextModerator: moderatorRows.length > pageSize ? moderatorRows[pageSize - 1]!.id : null,
    }
  }
}
