import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const familyFeedbackCampaigns = pgTable('family_feedback_campaigns', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  academicPeriodId: text('academic_period_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  classSubjectId: text('class_subject_id').notNull(),
  teacherAssignmentId: text('teacher_assignment_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  subjectId: text('subject_id').notNull(),
  questionVersion: text('question_version').notNull(),
  status: text('status').notNull(),
  opensAt: timestamp('opens_at', { mode: 'date' }),
  closesAt: timestamp('closes_at', { mode: 'date' }),
  openedAt: timestamp('opened_at', { mode: 'date' }),
  closedAt: timestamp('closed_at', { mode: 'date' }),
  cancelledAt: timestamp('cancelled_at', { mode: 'date' }),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  archivedAt: timestamp('archived_at', { mode: 'date' }),
  answersPurgedAt: timestamp('answers_purged_at', { mode: 'date' }),
  moderatorStaffId: text('moderator_staff_id'),
  themeDraft: text('theme_draft'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('family_feedback_campaigns', table))

export const familyFeedbackSlots = pgTable('family_feedback_slots', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  campaignId: text('campaign_id').notNull(),
  studentId: text('student_id').notNull(),
  teacherAssignmentId: text('teacher_assignment_id').notNull(),
  status: text('status').notNull(),
  completingGuardianId: text('completing_guardian_id'),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('family_feedback_slots', table))

export const familyFeedbackResponses = pgTable('family_feedback_responses', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  campaignId: text('campaign_id').notNull(),
  slotId: text('slot_id').notNull(),
  answers: jsonb('answers').notNull(),
  comment: text('comment'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('family_feedback_responses', table))

export const familyFeedbackSnapshots = pgTable('family_feedback_snapshots', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  campaignId: text('campaign_id').notNull(),
  payload: jsonb('payload').notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }).notNull(),
  publishedByStaffId: text('published_by_staff_id').notNull(),
}, table => definePerformanceIndexes('family_feedback_snapshots', table))

export const familyFeedbackCommentReadAudit = pgTable('family_feedback_comment_read_audit', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  campaignId: text('campaign_id').notNull(),
  actorId: text('actor_id').notNull(),
  actorKind: text('actor_kind').notNull(),
  subjectId: text('subject_id').notNull(),
  readAt: timestamp('read_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('family_feedback_comment_read_audit', table))
