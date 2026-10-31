import type { Conversation, ConversationMessage, ConversationReadScope, ConversationsPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { conversationMessageSchema, conversationSchema } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface DatabaseRow { id?: unknown, school_id?: unknown, guardian_id?: unknown, destination?: unknown, teacher_id?: unknown, student_id?: unknown, assignment_ids?: unknown, payload?: unknown, unread?: unknown, total?: unknown, unread_count?: unknown }
interface Executor { execute: (query: SQL) => Promise<{ rows: DatabaseRow[] }> }
export class PostgresConversations implements ConversationsPort {
  constructor(private readonly db: Executor) {}
  private executor() { return (transactionContext.getStore() as Executor | undefined) ?? this.db }
  private ids(scope: ConversationReadScope) { return scope.ids.length ? sql`c.school_id=${scope.schoolId} and c.id in (select jsonb_array_elements_text(${JSON.stringify(scope.ids)}::jsonb))` : sql`false` }
  private unreadSql(scope: ConversationReadScope) {
    return sql`exists(select 1 from conversation_messages m where m.school_id=c.school_id and m.conversation_id=c.id
      and m.sequence>coalesce((select r.through_sequence from conversation_reads r where r.school_id=c.school_id and r.conversation_id=c.id and r.profile_kind=${scope.profileKind} and r.profile_id=${scope.profileId}),0)
      and ${scope.profileKind === 'guardian' ? sql`m.author_kind<>'guardian'` : sql`m.author_kind='guardian'`})`
  }

  async placements(schoolId: string) {
    const { rows } = await this.executor().execute(sql`select id,school_id,guardian_id,destination,payload->>'teacherId' as teacher_id,payload->>'studentId' as student_id,payload->'assignmentIds' as assignment_ids from conversations where school_id=${schoolId}`)
    return rows.map(row => ({ id: String(row.id), schoolId: String(row.school_id), guardianId: String(row.guardian_id), destination: row.destination as 'school' | 'teacher', teacherId: row.teacher_id as string | undefined ?? undefined, studentId: row.student_id as string | undefined ?? undefined, assignmentIds: row.assignment_ids as string[] }))
  }

  async placement(schoolId: string, id: string) { return (await this.placements(schoolId)).find(row => row.id === id) }
  async find(scope: ConversationReadScope, id: string) {
    const { rows } = await this.executor().execute(sql`select c.payload from conversations c where ${this.ids(scope)} and c.id=${id}`)
    return rows[0] ? conversationSchema.parse(rows[0].payload) : undefined
  }

  async list(scope: ConversationReadScope, input: Parameters<ConversationsPort['list']>[1]) {
    const search = input.search?.trim()
    const matching = search
      ? sql`and (strpos(lower(concat_ws(' ',c.payload->>'subject',c.payload->>'guardianName',c.payload->>'teacherName',c.payload->>'studentName',c.payload->>'schoolName')),lower(${search}))>0
      or exists(select 1 from conversation_messages m where m.school_id=c.school_id and m.conversation_id=c.id
        and strpos(lower(concat_ws(' ',m.payload->>'body',m.payload->>'authorName')),lower(${search}))>0))`
      : sql``
    const filter = sql`${this.ids(scope)} ${matching} ${input.destination ? sql`and c.destination=${input.destination}` : sql``} ${input.status ? sql`and c.status=${input.status}` : sql``}`
    const [page, counts] = await Promise.all([
      this.executor().execute(sql`select c.payload,${this.unreadSql(scope)} as unread from conversations c where ${filter} order by ${input.order === 'oldest_awaiting' ? sql`case when c.status='awaiting_school' then 0 else 1 end,c.awaiting_since asc` : sql`c.updated_at desc`},c.id limit ${input.limit} offset ${input.offset}`),
      this.executor().execute(sql`select count(*) as total,count(*) filter(where ${this.unreadSql(scope)}) as unread_count from conversations c where ${filter}`),
    ])
    return { items: page.rows.map(row => ({ ...conversationSchema.parse(row.payload), unread: Boolean(row.unread) })), total: Number(counts.rows[0]?.total ?? 0), unreadCount: Number(counts.rows[0]?.unread_count ?? 0) }
  }

  async messages(scope: ConversationReadScope, id: string, before: number | undefined, limit: number) {
    const { rows } = await this.executor().execute(sql`select m.payload from conversation_messages m join conversations c on c.id=m.conversation_id and c.school_id=m.school_id where ${this.ids(scope)} and c.id=${id} ${before ? sql`and m.sequence<${before}` : sql``} order by m.sequence desc limit ${limit}`)
    return rows.map(row => conversationMessageSchema.parse(row.payload)).reverse()
  }

  async save(row: Conversation) {
    await this.executor().execute(sql`insert into conversations(id,school_id,guardian_id,destination,status,updated_at,awaiting_since,payload) values(${row.id},${row.schoolId},${row.guardianId},${row.destination},${row.status},${row.updatedAt}::timestamptz,${row.awaitingSince}::timestamptz,${JSON.stringify(row)}::jsonb) on conflict(id) do update set status=excluded.status,updated_at=excluded.updated_at,awaiting_since=excluded.awaiting_since,payload=excluded.payload where conversations.school_id=excluded.school_id`)
  }

  async append(row: ConversationMessage) {
    await this.executor().execute(sql`insert into conversation_messages(id,school_id,conversation_id,sequence,author_kind,payload) values(${row.id},${row.schoolId},${row.conversationId},${row.sequence},${row.authorKind},${JSON.stringify(row)}::jsonb)`)
  }

  async markRead(scope: ConversationReadScope, id: string, through: number) {
    await this.executor().execute(sql`insert into conversation_reads(school_id,conversation_id,profile_kind,profile_id,through_sequence) select c.school_id,c.id,${scope.profileKind},${scope.profileId},${through} from conversations c where ${this.ids(scope)} and c.id=${id} on conflict(school_id,conversation_id,profile_kind,profile_id) do update set through_sequence=greatest(conversation_reads.through_sequence,excluded.through_sequence)`)
  }

  async unread(scope: ConversationReadScope, id: string) {
    const { rows } = await this.executor().execute(sql`select ${this.unreadSql(scope)} as unread from conversations c where ${this.ids(scope)} and c.id=${id}`)
    return Boolean(rows[0]?.unread)
  }
}
