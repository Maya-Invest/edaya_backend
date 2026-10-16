import { boolean, integer, jsonb, numeric, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const assessments = pgTable('assessments', {
  id: text('id').primaryKey(),
  classGroupId: text('class_group_id').notNull(),
  classSubjectId: text('class_subject_id').notNull(),
  periodId: text('period_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  maxScore: numeric('max_score', { precision: 8, scale: 2 }).notNull(),
  coefficient: numeric('coefficient', { precision: 8, scale: 2 }).notNull(),
  description: text('description'),
  attachments: jsonb('attachments').notNull().default([]),
  lessonSessionId: text('lesson_session_id'),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  dueAt: timestamp('due_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  marksStatus: text('marks_status').notNull().default('draft'),
  marksRevision: integer('marks_revision').notNull().default(0),
  marksReview: jsonb('marks_review').notNull().default({}),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('assessments', table))

// 28. Assessment Result Table

export const assessmentResults = pgTable('assessment_results', {
  revision: integer('revision').notNull().default(0),
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  assessmentId: text('assessment_id').notNull(),
  mentionId: text('mention_id'),
  originalEntry: jsonb('original_entry'),
  calculation: jsonb('calculation'),
  score: numeric('score'),
  designation: text('designation'),
  status: text('status'),
  notes: text('notes'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('assessment_results', table))

// 29. Grade Scale Table

export const gradeScales = pgTable('grade_scales', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  minScore: numeric('min_score').notNull(),
  maxScore: numeric('max_score').notNull(),
  ranges: jsonb('ranges').notNull(),
  decimalPlaces: integer('decimal_places').notNull().default(1),
  roundingMode: text('rounding_mode').notNull().default('nearest'),
  intervalConvention: text('interval_convention').notNull().default('legacy-closed'),
  revision: integer('revision').notNull().default(0),
  description: text('description'),
  isDefault: boolean('is_default').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('grade_scales', table))

export const reportCardDefinitions = pgTable('report_card_definitions', {
  passThreshold: numeric('pass_threshold'),
  revision: integer('revision').notNull().default(0),
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  gradeLevelId: text('grade_level_id').notNull(),
  gradeScaleId: text('grade_scale_id').notNull(),
  name: text('name').notNull(),
  kind: text('kind').notNull(),
  status: text('status').notNull().default('draft'),
  isDefault: boolean('is_default').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('report_card_definitions', table))

// 31. Report Card Definition Section Table

export const reportCardDefinitionSections = pgTable('report_card_definition_sections', {
  id: text('id').primaryKey(),
  reportCardDefinitionId: text('definition_id').notNull(),
  name: text('name').notNull(),
  role: text('role'),
  coefficient: real('coefficient'),
  order: integer('order_val').notNull(),
  weight: real('weight').notNull(),
  parentSectionId: text('parent_section_id'),
  subjectId: text('subject_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('report_card_definition_sections', table))

// 32. Report Card Result Table

export const reportCardResults = pgTable('report_card_results', {
  id: text('id').primaryKey(),
  version: integer('version').notNull().default(0),
  sourceMarks: jsonb('source_marks').notNull().default([]),
  pendingCorrectionIds: jsonb('pending_correction_ids').notNull().default([]),
  sourceAssessments: jsonb('source_assessments').notNull().default([]),
  pendingAssessmentIds: jsonb('pending_assessment_ids').notNull().default([]),
  calculationStale: boolean('calculation_stale').notNull().default(false),
  grading: jsonb('grading'),
  aggregateLabel: text('aggregate_label'),
  gradingPolicyRevision: integer('grading_policy_revision'),
  revisedDraft: jsonb('revised_draft'),
  publicationHistory: jsonb('publication_history').notNull().default([]),
  studentId: text('student_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  periodId: text('period_id').notNull(),
  reportCardDefinitionId: text('report_card_definition_id').notNull(),
  sectionResults: jsonb('section_results').notNull(),
  attendanceSummary: jsonb('attendance_summary').notNull(),
  assessmentResultCount: integer('assessment_result_count').notNull(),
  overallAverage: numeric('overall_average'),
  rank: integer('rank'),
  classSize: integer('class_size'),
  passThreshold: numeric('pass_threshold'),
  teacherComment: text('teacher_comment'),
  principalComment: text('principal_comment'),
  status: text('status').notNull(),
  generatedAt: timestamp('generated_at', { mode: 'date' }).notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  aggregation: jsonb('aggregation'),
}, table => definePerformanceIndexes('report_card_results', table))

// 33. Student Table

// Command-owned correction requests are persisted through MarksCorrectionsPort.
export const assessmentMarksCorrections = pgTable('assessment_marks_corrections', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  assessmentId: text('assessment_id').notNull(),
  status: text('status').notNull(),
  version: integer('version').notNull(),
  payload: jsonb('payload').notNull(),
})
