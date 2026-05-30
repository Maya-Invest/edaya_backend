import { jsonb, pgTable, primaryKey, text } from 'drizzle-orm/pg-core'

export const entityStore = pgTable('entity_store', {
  entityType: text('entity_type').notNull(),
  id: text('id').notNull(),
  data: jsonb('data').notNull(),
}, table => ({
  pk: primaryKey({ columns: [table.entityType, table.id] }),
}))
