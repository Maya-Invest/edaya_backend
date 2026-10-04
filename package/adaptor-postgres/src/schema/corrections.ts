import { jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

/** These tables are command-owned and are never registered as CRUD resources. */
export const teacherCorrections = pgTable('teacher_corrections', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  classGroupId: text('class_group_id').notNull(),
  workflow: text('workflow').notNull(),
  targetId: text('target_id').notNull(),
  status: text('status').notNull(),
  createdAt: timestamp('created_at', { mode: 'date', withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
})
export const teacherWorkflowStates = pgTable('teacher_workflow_states', {
  schoolId: text('school_id').notNull(),
  workflow: text('workflow').notNull(),
  targetId: text('target_id').notNull(),
  payload: jsonb('payload').notNull(),
})
