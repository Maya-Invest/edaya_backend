import { integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const documentIssuances = pgTable('document_issuances', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  templateKey: text('template_key').notNull(),
  templateVersion: text('template_version').notNull(),
  locale: text('locale').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  sourceType: text('source_type').notNull(),
  sourceId: text('source_id').notNull(),
  sourceVersion: text('source_version').notNull(),
  studentId: text('student_id'),
  classGroupId: text('class_group_id'),
  snapshot: jsonb('snapshot').notNull(),
  issuerActorId: text('issuer_actor_id').notNull(),
  audience: text('audience').notNull(),
  requestId: text('request_id').notNull(),
  number: text('number'),
  status: text('status').notNull(),
  artifactAttachmentId: text('artifact_attachment_id'),
  artifactSha256: text('artifact_sha256'),
  artifactSize: integer('artifact_size'),
  replacesIssuanceId: text('replaces_issuance_id'),
  replacedByIssuanceId: text('replaced_by_issuance_id'),
  voidedAt: timestamp('voided_at', { mode: 'date' }),
  voidReason: text('void_reason'),
  failureCode: text('failure_code'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }),
}, table => definePerformanceIndexes('document_issuances', table))

export const documentNumberSeries = pgTable('document_number_series', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  documentKind: text('document_kind').notNull(),
  academicYearId: text('academic_year_id').notNull(),
  nextValue: integer('next_value').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('document_number_series', table))
