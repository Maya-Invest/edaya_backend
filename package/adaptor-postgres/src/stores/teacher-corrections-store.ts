import type { ActiveReportComment, CorrectionWorkflow, ResourceAccessScope, TeacherCorrection, TeacherCorrectionsPort, TeacherWorkflowState } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { correctionProposalSchema, teacherCorrectionSchema } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { classGroups } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Array<{ payload?: unknown, total?: unknown, target_id?: string, status?: ActiveReportComment['status'], locked?: boolean, includes_student?: boolean, submitted?: boolean }> }> }
export class PostgresTeacherCorrections implements TeacherCorrectionsPort {
  constructor(private readonly db: Executor) {}
  private executor() { return (transactionContext.getStore() as Executor | undefined) ?? this.db }
  async dailyAttendanceSubmitted(schoolId: string, workflowKey: string, attendanceId: string) {
    const { rows } = await this.executor().execute(sql`
      select coalesce(
        (select (payload->>'locked')::boolean from teacher_workflow_states
         where school_id=${schoolId} and workflow='attendance' and target_id=${workflowKey}),
        exists(select 1 from attendance_records r join attendances a on a.id=r.attendance_id
               where a.school_id=${schoolId} and a.id=${attendanceId})
      ) as submitted`)
    return rows[0]!.submitted!
  }

  async attendanceLessonStates(schoolId: string, lessonIds: readonly string[], studentId?: string) {
    if (!lessonIds.length)
      return []
    const keys = sql.join(lessonIds.map(id => sql`${`lesson:${id}`}`), sql`, `)
    const locked = sql`(payload->>'locked')::boolean`
    const includesStudent = studentId === undefined
      ? sql`false`
      : sql`
      (payload->'payload'->'entries') @> ${JSON.stringify([{ studentId }])}::jsonb
      or (${locked} and (payload->'payload'->'rosterStudentIds') @> ${JSON.stringify([studentId])}::jsonb)`
    const { rows } = await this.executor().execute(sql`
      select substring(target_id from 8) as target_id, ${locked} as locked,
        coalesce((${includesStudent}), false) as includes_student
      from teacher_workflow_states where school_id=${schoolId} and workflow='attendance' and target_id in (${keys})`)
    return rows.map(row => ({ lessonId: row.target_id!, locked: row.locked!, includesStudent: row.includes_student! }))
  }

  async referencedLessonSessionIds(schoolId: string, sessionIds: readonly string[]) {
    if (sessionIds.length === 0)
      return []
    const ids = sql.join(sessionIds.map(id => sql`${id}`), sql`, `)
    const attendanceKeys = sql.join(sessionIds.map(id => sql`${`lesson:${id}`}`), sql`, `)
    const { rows } = await this.executor().execute(sql`
      select target_id from teacher_workflow_states where school_id=${schoolId} and workflow='logbook' and target_id in (${ids})
      union
      select target_id from teacher_corrections where school_id=${schoolId} and workflow='logbook' and target_id in (${ids})
      union
      select substring(target_id from 8) as target_id from teacher_workflow_states where school_id=${schoolId} and workflow='attendance' and target_id in (${attendanceKeys})
        and ((payload->>'locked')::boolean or payload->'payload' <> '{}'::jsonb or payload->'history' <> '[]'::jsonb)
    `)
    return rows.map(row => row.target_id!)
  }

  async visibleReportSnapshots(schoolId: string, reportIds: readonly string[]) {
    if (!reportIds.length)
      return []
    const ids = sql.join(reportIds.map(id => sql`${id}`), sql`, `)
    const { rows } = await this.executor().execute(sql`
      select target_id, payload->'payload'->'visibleSnapshot' as payload from teacher_workflow_states
      where school_id=${schoolId} and workflow='report_comments' and target_id in (${ids})
        and payload->'payload'->'visibleSnapshot' is not null`)
    return rows.map(row => ({ reportId: row.target_id!, snapshot: row.payload }))
  }

  async activeReportComments(schoolId: string, classGroupId: string, authorSubjectId: string, reportIds: readonly string[]): Promise<ActiveReportComment[]> {
    if (!reportIds.length)
      return []
    const ids = sql.join(reportIds.map(id => sql`${id}`), sql`, `)
    const { rows } = await this.executor().execute(sql`
      select status, payload->'proposal' as payload from teacher_corrections
      where school_id=${schoolId} and class_group_id=${classGroupId} and workflow='report_comments' and target_id in (${ids})
        and status in ('pending','approved_pending_publication') and payload->>'authorSubjectId'=${authorSubjectId}
        and payload->'proposal'->>'targetId'=target_id order by target_id,created_at,id`)
    return rows.map(row => ({ status: row.status!, proposal: correctionProposalSchema.options[1].parse(row.payload) }))
  }

  async find(schoolId: string, id: string) {
    const { rows } = await this.executor().execute(sql`select payload from teacher_corrections where school_id=${schoolId} and id=${id}`)
    return rows[0] ? teacherCorrectionSchema.parse(rows[0].payload) : undefined
  }

  async save(row: TeacherCorrection) {
    await this.executor().execute(sql`insert into teacher_corrections(id,school_id,class_group_id,workflow,target_id,status,created_at,payload)
      values (${row.id},${row.schoolId},${row.classGroupId},${row.workflow},${row.targetId},${row.status},${row.createdAt},${JSON.stringify(row)}::jsonb)
      on conflict(id) do update set status=excluded.status,payload=excluded.payload`)
  }

  async forTarget(schoolId: string, workflow: CorrectionWorkflow, targetId: string) {
    const { rows } = await this.executor().execute(sql`select payload from teacher_corrections where school_id=${schoolId} and workflow=${workflow} and target_id=${targetId} order by created_at,id`)
    return rows.map(row => teacherCorrectionSchema.parse(row.payload))
  }

  async list(scope: ResourceAccessScope, input: Parameters<TeacherCorrectionsPort['list']>[1]) {
    const predicate = sql`${compileResourceAccess(classGroups, scope)} and c.workflow=${input.workflow} and c.status=${input.status}
      ${input.classGroupId ? sql`and c.class_group_id=${input.classGroupId}` : sql``}
      ${input.periodId ? sql`and c.payload->>'periodId'=${input.periodId}` : sql``}
      ${input.teacherSubjectId ? sql`and c.payload->>'authorSubjectId'=${input.teacherSubjectId}` : sql``}
      ${input.studentId ? sql`and c.payload->'studentIds' @> ${JSON.stringify([input.studentId])}::jsonb` : sql``}
      ${input.search ? sql`and (c.payload->>'reason' ilike ${`%${input.search}%`} or ${classGroups.name} ilike ${`%${input.search}%`} or exists(select 1 from teachers t where t.subject_id=c.payload->>'authorSubjectId' and concat(t.first_name,' ',t.last_name) ilike ${`%${input.search}%`}) or exists(select 1 from students s where c.payload->'studentIds' @> jsonb_build_array(s.id) and concat(s.first_name,' ',s.last_name) ilike ${`%${input.search}%`}))` : sql``}
      ${input.from ? sql`and c.created_at>=${input.from}` : sql``}
      ${input.to ? sql`and c.created_at<=${input.to}` : sql``}`
    const executor = this.executor()
    const [page, count] = await Promise.all([
      executor.execute(sql`select c.payload from teacher_corrections c join ${classGroups} on ${classGroups.id}=c.class_group_id where ${predicate} order by c.created_at,c.id limit ${input.limit} offset ${input.offset}`),
      executor.execute(sql`select count(*) as total from teacher_corrections c join ${classGroups} on ${classGroups.id}=c.class_group_id where ${predicate}`),
    ])
    return { items: page.rows.map(row => teacherCorrectionSchema.parse(row.payload)), total: Number(count.rows[0]?.total ?? 0) }
  }

  async state(schoolId: string, workflow: CorrectionWorkflow, targetId: string) {
    const { rows } = await this.executor().execute(sql`select payload from teacher_workflow_states where school_id=${schoolId} and workflow=${workflow} and target_id=${targetId}`)
    return rows[0]?.payload as TeacherWorkflowState | undefined
  }

  async saveState(state: TeacherWorkflowState) {
    await this.executor().execute(sql`insert into teacher_workflow_states(school_id,workflow,target_id,payload) values(${state.schoolId},${state.workflow},${state.targetId},${JSON.stringify(state)}::jsonb)
      on conflict(school_id,workflow,target_id) do update set payload=excluded.payload`)
  }
}
