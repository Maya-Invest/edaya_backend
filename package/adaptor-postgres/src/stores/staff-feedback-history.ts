import type { StaffFeedbackHistoryBoundary, StaffFeedbackHistoryFilter, StaffFeedbackHistoryPort, StaffFeedbackOptionScopes } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { staffFeedbackHistoryPageSize, staffFeedbackHistoryRow } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'
import { visibleFeedbackLabels } from './staff-feedback-options'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

// The staff catalog translates a grade stem only at a word boundary and retains the class suffix.
const gradeStems = [
  ['6ème', '6th'],
  ['5ème', '5th'],
  ['4ème', '4th'],
  ['3ème', '3rd'],
  ['2nde A', '10th A'],
  ['2nde C', '10th C'],
  ['1ère A', '11th A'],
  ['1ère C', '11th C'],
  ['1ère D', '11th D'],
  ['Tle A', '12th A'],
  ['Tle C', '12th C'],
  ['Tle D', '12th D'],
]

function campaignLabels(filter: StaffFeedbackHistoryFilter, scopes: StaffFeedbackOptionScopes) {
  if (!filter.academicYearId || !scopes.teacherAssignments)
    return { joins: sql``, title: sql`c.teacher_assignment_id` }
  const visible = (resource: keyof StaffFeedbackOptionScopes) => visibleFeedbackLabels(scopes, resource)
  const translations = gradeStems.map(([fr, en]) => sql`(${fr}::text,${en}::text)`)
  const joins = sql`left join (${visible('teacherAssignments')}) a on a.id=c.teacher_assignment_id
      and a.academic_year_id=${filter.academicYearId} and a.kind='subject' and a.status='active' and a.class_subject_id is not null
    left join (${visible('teachers')}) t on t.id=a.teacher_id
    left join (${visible('classSubjects')}) o on o.id=a.class_subject_id
    left join (${visible('subjects')}) s on s.id=o.subject_id
    left join (${visible('classGroups')}) g on g.id=coalesce(a.class_group_id,o.class_group_id)
    left join lateral (
      select ${filter.lang === 'fr' ? sql`v.fr` : sql`v.en`} || substr(btrim(g.name),length(stem)+1) as name
      from (values ${sql.join(translations, sql`,`)}) v(fr,en)
      cross join lateral (values (v.fr),(v.en)) stems(stem)
      where btrim(g.name)=stem or starts_with(btrim(g.name),stem||' ')
    ) localized on true`
  const title = sql`coalesce(nullif(concat_ws(' · ', nullif(btrim(t.first_name||' '||t.last_name),''),
    nullif(s.name,''),nullif(coalesce(localized.name,g.name),'')),''),c.teacher_assignment_id)`
  return { joins, title }
}

export class PostgresStaffFeedbackHistory implements StaffFeedbackHistoryPort {
  constructor(private readonly db: Executor) {}

  async read(schoolId: string, filter: StaffFeedbackHistoryFilter, scopes: StaffFeedbackOptionScopes, page?: { after?: StaffFeedbackHistoryBoundary }) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const { joins, title } = campaignLabels(filter, scopes)
    const q = filter.q?.toLowerCase()
    const boundary = page?.after
    // A class with many campaigns often refers to only a few assignments. Resolve each visible
    // title once, including when a literal search needs it before counting and pagination.
    const source = q ? sql`campaigns` : sql`selected`
    const labels = sql`labels as materialized (
      select c.teacher_assignment_id,${title} as title
      from (select distinct teacher_assignment_id from ${source}) c ${joins}
    )`
    const matching = q ? sql`matches` : sql`campaigns`
    const result = await db.execute(sql`with campaigns as not materialized (
      select id,status,academic_period_id,teacher_assignment_id,opens_at,closes_at,created_at
      from family_feedback_campaigns where school_id=${schoolId} ${filter.status ? sql`and status=${filter.status}` : sql``}
    ),
    ${q
      ? sql`${labels}, matches as materialized (
      select c.*,l.title from campaigns c join labels l using(teacher_assignment_id)
      where strpos(lower(translate(l.title,'ÀÂÄÆÇÉÈÊËÎÏÔÖŒÙÛÜŸ','àâäæçéèêëîïôöœùûüÿ')),${q})>0 or strpos(c.status,${q})>0
    ),`
      : sql``}
    selected as (
      select * from ${matching}
      ${boundary ? sql`where (created_at,id)<(${boundary.createdAt}::timestamp,${boundary.id})` : sql``}
      order by created_at desc,id desc ${page ? sql`limit ${staffFeedbackHistoryPageSize + 1}` : sql``}
    ),
    ${q ? sql`` : sql`${labels},`}
    displayed as (
      select c.id,${q ? sql`c.title` : sql`l.title`} as title,c.status,c.academic_period_id as "academicPeriodId",
        to_char(c.opens_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "opensAt",
        to_char(c.closes_at,'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as "closesAt",
        to_char(c.created_at,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as "createdAt",c.created_at as sort_date
      from selected c ${q ? sql`` : sql`join labels l using(teacher_assignment_id)`}
    )
    select d.* ${page ? sql`, totals.total from (select count(*)::int as total from ${matching}) totals left join displayed d on true` : sql`from displayed d`}
    order by d.sort_date desc,d.id desc`)
    const rows = result.rows.filter(({ id }) => id !== null)
    const visible = page ? rows.slice(0, staffFeedbackHistoryPageSize) : rows
    const { id, createdAt } = visible.at(-1) ?? {}
    const { total } = result.rows[0] ?? {}
    return {
      items: visible.map(row => staffFeedbackHistoryRow.parse(row)),
      total: page ? Number(total ?? 0) : rows.length,
      next: page && rows.length > visible.length ? { id: String(id), createdAt: String(createdAt) } : null,
    }
  }
}
