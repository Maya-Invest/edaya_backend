import { sql } from 'drizzle-orm'
import { boolean, check, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique } from 'drizzle-orm/pg-core'
import { schools } from './school'

export const schoolImportBatches = pgTable('school_import_batches', {
  schoolId: text('school_id').notNull().references(() => schools.id),
  id: text('id').notNull(),
  data: jsonb('data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
}, table => [primaryKey({ columns: [table.schoolId, table.id] }), index('school_import_batches_history').on(table.schoolId, table.createdAt.desc(), table.id), check('school_import_batches_mode_check', sql`${table.data}->>'defaultOnExisting' IN ('S', 'M', 'O')`)])
export const schoolImportFiles = pgTable('school_import_files', {
  schoolId: text('school_id').notNull(),
  batchId: text('batch_id').notNull(),
  id: text('id').notNull(),
  fileId: text('file_id').notNull(),
  revision: integer('revision').notNull(),
  data: jsonb('data').notNull(),
}, table => [primaryKey({ columns: [table.schoolId, table.id] }), unique().on(table.schoolId, table.batchId, table.fileId, table.revision), check('school_import_files_revision_check', sql`${table.revision} > 0`), foreignKey({ columns: [table.schoolId, table.batchId], foreignColumns: [schoolImportBatches.schoolId, schoolImportBatches.id] })])
export const schoolImportRows = pgTable('school_import_rows', {
  schoolId: text('school_id').notNull(),
  batchId: text('batch_id').notNull(),
  id: text('id').notNull(),
  data: jsonb('data').notNull(),
}, table => [primaryKey({ columns: [table.schoolId, table.batchId, table.id] }), foreignKey({ columns: [table.schoolId, table.batchId], foreignColumns: [schoolImportBatches.schoolId, schoolImportBatches.id] })])
export const schoolImportIdentities = pgTable('school_import_identities', {
  schoolId: text('school_id').notNull().references(() => schools.id),
  type: text('type').notNull(),
  sourceKey: text('source_key').notNull(),
  targetId: text('target_id').notNull(),
  generatedCode: text('generated_code'),
  bound: boolean('bound').notNull().default(false),
}, table => [primaryKey({ columns: [table.schoolId, table.type, table.sourceKey] })])
export const schoolImportOutcomes = pgTable('school_import_outcomes', {
  schoolId: text('school_id').notNull(),
  batchId: text('batch_id').notNull(),
  rowId: text('row_id').notNull(),
  operationId: text('operation_id').notNull(),
  inputDigest: text('input_digest').notNull(),
  data: jsonb('data').notNull(),
}, table => [primaryKey({ columns: [table.schoolId, table.operationId] }), unique().on(table.schoolId, table.batchId, table.rowId, table.inputDigest), foreignKey({ columns: [table.schoolId, table.batchId, table.rowId], foreignColumns: [schoolImportRows.schoolId, schoolImportRows.batchId, schoolImportRows.id] })])
export const schoolImportRowRevisions = pgTable('school_import_row_revisions', {
  schoolId: text('school_id').notNull(),
  batchId: text('batch_id').notNull(),
  rowId: text('row_id').notNull(),
  revisionId: text('revision_id').notNull(),
  data: jsonb('data').notNull(),
}, table => [primaryKey({ columns: [table.schoolId, table.batchId, table.rowId, table.revisionId] }), foreignKey({ columns: [table.schoolId, table.revisionId], foreignColumns: [schoolImportFiles.schoolId, schoolImportFiles.id] }), foreignKey({ columns: [table.schoolId, table.batchId], foreignColumns: [schoolImportBatches.schoolId, schoolImportBatches.id] })])
