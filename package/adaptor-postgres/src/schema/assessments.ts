import { boolean, integer, jsonb, pgTable, real, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const assessments = pgTable('assessments', {
  id: text('id').primaryKey(),
  classGroupId: text('class_group_id').notNull(),
  classSubjectId: text('class_subject_id').notNull(),
  periodId: text('period_id').notNull(),
  title: text('title').notNull(),
  kind: text('kind').notNull(),
  maxScore: integer('max_score').notNull(),
  coefficient: integer('coefficient').notNull(),
  description: text('description'),
  attachments: jsonb('attachments').notNull().default([]),
  lessonSessionId: text('lesson_session_id'),
  startsAt: timestamp('starts_at', { mode: 'date' }),
  endsAt: timestamp('ends_at', { mode: 'date' }),
  dueAt: timestamp('due_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('assessments', table))

// 28. Assessment Result Table

export const assessmentResults = pgTable('assessment_results', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  assessmentId: text('assessment_id').notNull(),
  score: integer('score'),
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
  minScore: integer('min_score').notNull(),
  maxScore: integer('max_score').notNull(),
  ranges: jsonb('ranges').notNull(),
  decimalPlaces: integer('decimal_places').notNull().default(1),
  description: text('description'),
  isDefault: boolean('is_default').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('grade_scales', table))

export const reportCardDefinitions = pgTable('report_card_definitions', {
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
  weight: integer('weight').notNull(),
  parentSectionId: text('parent_section_id'),
  subjectId: text('subject_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('report_card_definition_sections', table))

// 32. Report Card Result Table

export const reportCardResults = pgTable('report_card_results', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  periodId: text('period_id').notNull(),
  reportCardDefinitionId: text('report_card_definition_id').notNull(),
  sectionResults: jsonb('section_results').notNull(),
  attendanceSummary: jsonb('attendance_summary').notNull(),
  assessmentResultCount: integer('assessment_result_count').notNull(),
  overallAverage: integer('overall_average'),
  rank: integer('rank'),
  classSize: integer('class_size'),
  passThreshold: integer('pass_threshold'),
  teacherComment: text('teacher_comment'),
  principalComment: text('principal_comment'),
  status: text('status').notNull(),
  generatedAt: timestamp('generated_at', { mode: 'date' }).notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  aggregation: jsonb('aggregation'),
}, table => definePerformanceIndexes('report_card_results', table))

// 33. Student Table
