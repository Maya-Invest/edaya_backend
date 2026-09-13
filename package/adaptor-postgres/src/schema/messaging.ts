import { pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { definePerformanceIndexes } from '../postgres-indexes'

export const announcements = pgTable('announcements', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  title: text('title').notNull(),
  content: text('content').notNull(),
  createdBy: text('created_by'),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  publishedAt: timestamp('published_at', { mode: 'date' }),
  expiresAt: timestamp('expires_at', { mode: 'date' }),
}, table => definePerformanceIndexes('announcements', table))

export const announcementTargets = pgTable('announcement_targets', {
  id: text('id').primaryKey(),
  announcementId: text('announcement_id').notNull(),
  targetKind: text('target_kind').notNull(),
  targetId: text('target_id'),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('announcement_targets', table))

// 20. Message Delivery Table

export const messageDeliveries = pgTable('message_deliveries', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  announcementId: text('announcement_id'),
  eventKey: text('event_key'),
  sourceKey: text('source_key'),
  subjectId: text('subject_id').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  recipientKind: text('recipient_kind'),
  recipientId: text('recipient_id'),
  status: text('status').notNull(),
  providerMessageId: text('provider_message_id'),
  failureReason: text('failure_reason'),
  sentAt: timestamp('sent_at', { mode: 'date' }),
  readAt: timestamp('read_at', { mode: 'date' }),
  createdAt: timestamp('created_at', { mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull(),
}, table => definePerformanceIndexes('message_deliveries', table))

// 21. Subject Table
