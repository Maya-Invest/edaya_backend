import { sql } from 'drizzle-orm'
import { boolean, doublePrecision, index, jsonb, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const academicDisciplines = pgTable('academic_disciplines', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => [
  ...definePerformanceIndexes('academic_disciplines', table),
  uniqueIndex('academic_disciplines_school_code_unique').on(table.schoolId, sql`lower(${table.code})`),
])

export const placementStatuses = pgTable('placement_statuses', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  code: text('code').notNull(),
  label: text('label').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => [
  ...definePerformanceIndexes('placement_statuses', table),
  uniqueIndex('placement_statuses_school_code_unique').on(table.schoolId, sql`lower(${table.code})`),
])

export const studentAcademicYearProfiles = pgTable('student_academic_year_profiles', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  studentId: text('student_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  placementStatusId: text('placement_status_id'),
  isRepeating: boolean('is_repeating'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => [
  ...definePerformanceIndexes('student_academic_year_profiles', table),
  uniqueIndex('student_academic_year_profiles_person_year_unique').on(table.schoolId, table.studentId, table.academicYearId),
  index('student_academic_year_profiles_school_year_idx').on(table.schoolId, table.academicYearId),
])

export const teacherAcademicYearProfiles = pgTable('teacher_academic_year_profiles', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  teacherId: text('teacher_id').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  disciplineIds: jsonb('discipline_ids').$type<string[]>().notNull().default([]),
  declaredHours: doublePrecision('declared_hours'),
  hoursPeriod: text('hours_period').notNull().default('unspecified'),
  hoursPeriodLabel: text('hours_period_label'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => [
  ...definePerformanceIndexes('teacher_academic_year_profiles', table),
  uniqueIndex('teacher_academic_year_profiles_person_year_unique').on(table.schoolId, table.teacherId, table.academicYearId),
  index('teacher_academic_year_profiles_school_year_idx').on(table.schoolId, table.academicYearId),
])
