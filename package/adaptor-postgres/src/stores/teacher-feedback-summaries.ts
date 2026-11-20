import type { TeacherFeedbackSelection, TeacherFeedbackSummariesPort } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { teacherFeedbackSummary } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

export class PostgresTeacherFeedbackSummaries implements TeacherFeedbackSummariesPort {
  constructor(private readonly db: Executor) {}

  async list(schoolId: string, teacherId: string, selection: TeacherFeedbackSelection) {
    const db = (transactionContext.getStore() as Executor | undefined) ?? this.db
    const result = await db.execute(sql`
      select c.id as "campaignId", c.academic_year_id as "academicYearId",
        c.academic_period_id as "academicPeriodId", c.class_group_id as "classGroupId", c.class_subject_id as "classSubjectId",
        (s.payload->>'eligibleSlotCount')::int as "eligibleSlotCount", (s.payload->>'completedSlotCount')::int as "completedSlotCount",
        (s.payload->>'responseRate')::double precision as "responseRate", (s.payload->>'overallSuppressed')::boolean as "overallSuppressed",
        case when (s.payload->>'overallSuppressed')::boolean = false then s.payload->>'themes' end as themes
      from family_feedback_campaigns c
      join teachers t on t.id=c.teacher_id and t.school_id=c.school_id and t.is_active
      join family_feedback_snapshots s on s.school_id=c.school_id and s.campaign_id=c.id and s.id='ffsnap:' || c.id
      where c.school_id=${schoolId} and c.teacher_id=${teacherId} and c.status='published'
        ${selection.classGroupId ? sql`and c.class_group_id=${selection.classGroupId}` : sql``}
        ${selection.classSubjectId ? sql`and c.class_subject_id=${selection.classSubjectId}` : sql``}
      order by c.id`)
    return result.rows.map(row => teacherFeedbackSummary.parse(row))
  }
}
