import type { CorrectionWorkflow, ResourceAccessScope, TeacherCorrection, TeacherCorrectionsPort, TeacherWorkflowState } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { teacherCorrectionSchema } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { classGroups } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Array<{ payload?: unknown, total?: unknown }> }> }
export class PostgresTeacherCorrections implements TeacherCorrectionsPort {
  constructor(private readonly db: Executor) {}
  private executor() { return (transactionContext.getStore() as Executor | undefined) ?? this.db }
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
