import { foreignKey, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const conversations = pgTable('conversations', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  guardianId: text('guardian_id').notNull(),
  destination: text('destination').notNull(),
  status: text('status').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  awaitingSince: timestamp('awaiting_since', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
}, t => [uniqueIndex('conversations_school_id').on(t.schoolId, t.id)])
export const conversationMessages = pgTable('conversation_messages', {
  id: text('id').primaryKey(),
  schoolId: text('school_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  sequence: integer('sequence').notNull(),
  authorKind: text('author_kind').notNull(),
  payload: jsonb('payload').notNull(),
}, t => [uniqueIndex('conversation_messages_sequence').on(t.conversationId, t.sequence), foreignKey({ columns: [t.schoolId, t.conversationId], foreignColumns: [conversations.schoolId, conversations.id] })])
export const conversationReads = pgTable('conversation_reads', {
  schoolId: text('school_id').notNull(),
  conversationId: text('conversation_id').notNull(),
  profileKind: text('profile_kind').notNull(),
  profileId: text('profile_id').notNull(),
  throughSequence: integer('through_sequence').notNull(),
}, t => [primaryKey({ columns: [t.schoolId, t.conversationId, t.profileKind, t.profileId] }), foreignKey({ columns: [t.schoolId, t.conversationId], foreignColumns: [conversations.schoolId, conversations.id] })])
