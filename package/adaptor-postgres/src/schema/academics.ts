import { sql } from 'drizzle-orm'
import { boolean, check, doublePrecision, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const academicYears = pgTable('academic_years', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  shortName: text('short_name').notNull(),
}, table => definePerformanceIndexes('academic_years', table))

// 3. Academic Period Table

export const academicPeriods = pgTable('academic_periods', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  name: text('name').notNull(),
  type: text('type'),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  isPublished: boolean('is_published').notNull().default(false),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  shortName: text('short_name').notNull(),
}, table => definePerformanceIndexes('academic_periods', table))

// 4. Period Definition Table

export const periodDefinitions = pgTable('period_definitions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  name: text('name').notNull(),
  dayOfWeek: text('day_of_week').notNull(),
  order: integer('order_val').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isBreak: boolean('is_break').notNull().default(false),
  isTeachingSlot: boolean('is_teaching_slot').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  shortName: text('short_name').notNull(),
}, table => definePerformanceIndexes('period_definitions', table))

// 5. Grade Level Table

export const gradeLevels = pgTable('grade_levels', {
  reportSettings: jsonb('report_settings').notNull().default([]),
  gradingPolicies: jsonb('grading_policies').notNull().default([]),
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  order: integer('order_val').notNull(),
  cycle: text('cycle'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('grade_levels', table))

// 6. Staff Member Table

export const subjectCategories = pgTable('subject_categories', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  shortName: text('short_name').notNull(),
}, table => definePerformanceIndexes('subject_categories', table))

export const subjects = pgTable('subjects', {
  legacyCode: text('legacy_code'),
  disciplineId: text('discipline_id'),
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  gradeLevelId: text('grade_level_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  shortName: text('short_name').notNull(),
  reportModuleId: text('report_module_id'),
  reportOrder: integer('report_order').notNull().default(0),
  coefficient: doublePrecision('coefficient'),
  periodsPerWeek: integer('periods_per_week'),
  minPeriodSpan: integer('min_period_span'),
  maxPeriodSpan: integer('max_period_span'),
  isOptional: boolean('is_optional').notNull().default(false),
  categoryId: text('category_id').notNull(),
  color: text('color').notNull().default('mint'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('subjects', table))

// 22. Subject Matter Table

export const subjectMatters = pgTable('subject_matters', {
  id: text('id').primaryKey(),
  subjectId: text('subject_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  sequenceOrder: integer('sequence_order').notNull(),
  progressWeight: doublePrecision('progress_weight').notNull().default(1),
  estimatedHours: integer('estimated_hours'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  shortName: text('short_name').notNull(),
}, table => [...definePerformanceIndexes('subject_matters', table), check('subject_matters_progress_weight_check', sql`${table.progressWeight} > 0 AND ${table.progressWeight} < 'Infinity'::double precision`)])

// 23. Class Group Table

export const classGroups = pgTable('class_groups', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  gradeLevelId: text('grade_level_id').notNull(),
  name: text('name').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  capacity: integer('capacity'),
  attendanceMode: text('attendance_mode').notNull().default('session'),
  homeroomStaffId: text('homeroom_staff_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  shortName: text('short_name').notNull(),
}, table => definePerformanceIndexes('class_groups', table))

// 24. Class Subject Table

export const classSubjects = pgTable('class_subjects', {
  id: text('id').primaryKey(),
  classGroupId: text('class_group_id').notNull(),
  subjectId: text('subject_id').notNull(),
  coefficient: doublePrecision('coefficient'),
  periodsPerWeek: integer('periods_per_week'),
  minPeriodSpan: integer('min_period_span'),
  maxPeriodSpan: integer('max_period_span'),
  chapterCount: integer('chapter_count').notNull().default(0),
  ongoingChapterCount: integer('ongoing_chapter_count').notNull().default(0),
  completedChapterCount: integer('completed_chapter_count').notNull().default(0),
  participationRevision: integer('participation_revision').notNull().default(0),
  isOffered: boolean('is_offered').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  completedPercentage: integer('completed_percentage').notNull().default(0),
}, table => [...definePerformanceIndexes('class_subjects', table), uniqueIndex('class_subjects_class_subject_uidx').on(table.classGroupId, table.subjectId)])

// 28. Activity Table (school program / club)

export const classSubjectMatters = pgTable('class_subject_matters', {
  id: text('id').primaryKey(),
  classSubjectId: text('class_subject_id').notNull(),
  subjectMatterId: text('subject_matter_id').notNull(),
  status: text('status').notNull().default('not_started'),
  completedPercentage: integer('completed_percentage').notNull().default(0),
  updatedByStaffId: text('updated_by_staff_id'),
  startedAt: timestamp('started_at', { mode: 'date' }),
  completedAt: timestamp('completed_at', { mode: 'date' }),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => [...definePerformanceIndexes('class_subject_matters', table), uniqueIndex('logbook_class_chapter_uidx').on(table.classSubjectId, table.subjectMatterId)])

// 26. Class Subject Progress Table

export const classSubjectProgress = pgTable('class_subject_progress', {
  id: text('id').primaryKey(),
  classSubjectMatterId: text('class_subject_matter_id').notNull(),
  lessonSessionId: text('lesson_session_id').notNull(),
  completed: boolean('completed'),
  legacyPercentage: integer('completed_percentage'),
  recordedByStaffId: text('recorded_by_staff_id'),
  notes: text('notes'),
  recordedAt: timestamp('recorded_at', { mode: 'date' }).notNull(),
}, table => [
  uniqueIndex('logbook_lesson_chapter_uidx').on(table.lessonSessionId, table.classSubjectMatterId),
  index('logbook_chapter_idx').on(table.classSubjectMatterId),
  check('logbook_counted_or_legacy_zero', sql`${table.completed} IS NOT NULL OR ${table.legacyPercentage} IS NOT DISTINCT FROM 0`),
])

// 27. Assessment Table

export const activities = pgTable('activities', {
  shortName: text('short_name').notNull(),
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  coach: text('coach').notNull(),
  schedule: text('schedule').notNull(),
  participants: integer('participants').notNull(),
  capacity: integer('capacity').notNull(),
  description: text('description').notNull(),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('activities', table))

// 29. Activity Enrollment Table

export const activityEnrollments = pgTable('activity_enrollments', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull(),
  studentId: text('student_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('activity_enrollments', table))

// 29b. Class Activity Enrollment Table

export const classActivityEnrollments = pgTable('class_activity_enrollments', {
  id: text('id').primaryKey(),
  activityId: text('activity_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('class_activity_enrollments', table))

// 30. Class Subject Matter Table

export const studentSubjectEnrollments = pgTable('student_subject_enrollments', {
  id: text('id').primaryKey(),
  studentClassEnrollmentId: text('student_class_enrollment_id').notNull(),
  classSubjectId: text('class_subject_id').notNull(),
  enrolledAt: timestamp('enrolled_at', { mode: 'date' }).notNull(),
  endedAt: timestamp('ended_at', { mode: 'date' }),
  source: text('source').notNull(),
  scope: text('scope').notNull().default('annual'),
  periods: jsonb('periods').notNull().default([]),
  deletedAt: timestamp('deleted_at', { mode: 'date' }),
  deletedBy: text('deleted_by'),
  revision: integer('revision').notNull().default(0),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => [...definePerformanceIndexes('student_subject_enrollments', table), uniqueIndex('student_subject_enrollments_current_idx').on(table.studentClassEnrollmentId, table.classSubjectId).where(sql`${table.deletedAt} IS NULL`)])
