import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const schedules = pgTable('schedules', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  scheduleKind: text('schedule_kind').notNull(),
  classSubjectId: text('class_subject_id'),
  activityId: text('activity_id'),
  title: text('title').notNull(),
  isRecurring: boolean('is_recurring').notNull(),
  dayOfWeek: text('day_of_week'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  specificDate: timestamp('specific_date', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('schedules', table))

export const lessonSessions = pgTable('lesson_sessions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  scheduleId: text('schedule_id'),
  timetableGenerated: boolean('timetable_generated').notNull().default(false),
  timetableTeacherIds: jsonb('timetable_teacher_ids').notNull().default([]),
  classSubjectId: text('class_subject_id').notNull(),
  status: text('status').notNull(),
  isException: boolean('is_exception').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  calendarDate: timestamp('calendar_date', { mode: 'date' }).notNull(),
  displayLabel: text('display_label').notNull(),
  sessionNote: text('session_note'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('lesson_sessions', table))

export const activitySessions = pgTable('activity_sessions', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  scheduleId: text('schedule_id').notNull(),
  activityId: text('activity_id').notNull(),
  status: text('status').notNull(),
  isException: boolean('is_exception').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  calendarDate: timestamp('calendar_date', { mode: 'date' }).notNull(),
  displayLabel: text('display_label').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('activity_sessions', table))

export const attendances = pgTable('attendances', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  startsAt: timestamp('starts_at', { mode: 'date' }).notNull(),
  endsAt: timestamp('ends_at', { mode: 'date' }).notNull(),
  displayLabel: text('display_label').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('attendances', table))

// 16. Calendar Event Table

export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  startDate: timestamp('start_date', { mode: 'date' }).notNull(),
  endDate: timestamp('end_date', { mode: 'date' }).notNull(),
  kind: text('kind').notNull(),
  isNonSchoolDay: boolean('is_non_school_day').notNull(),
  scopeKind: text('scope_kind').notNull(),
  scopeId: text('scope_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('calendar_events', table))

// 17. Attendance Record Table

export const attendanceRecords = pgTable('attendance_records', {
  id: text('id').primaryKey(),
  studentId: text('student_id').notNull(),
  attendanceId: text('attendance_id'),
  lessonSessionId: text('lesson_session_id'),
  activitySessionId: text('activity_session_id'),
  assessmentId: text('assessment_id'),
  date: timestamp('date', { mode: 'date' }).notNull(),
  status: text('status').notNull(),
  justificationStatus: text('justification_status').notNull(),
  reason: text('reason'),
  notes: text('notes'),
  justifiedAt: timestamp('justified_at', { mode: 'date' }),
  justifiedByStaffId: text('justified_by_staff_id'),
  correctedAt: timestamp('corrected_at', { mode: 'date' }),
  correctedByStaffId: text('corrected_by_staff_id'),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('attendance_records', table))

// 18. Announcement Table
