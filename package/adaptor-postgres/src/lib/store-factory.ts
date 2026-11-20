import type { StoreDatabase, StoreTable } from '../postgres-store'
import { PostgresStore } from '../postgres-store'
import { createDefaultMappers } from './mappers'

export function defaultStore<T extends { readonly id: string }, Input extends object>(
  db: StoreDatabase,
  table: StoreTable,
  Ctor: new (args: Input) => T,
): PostgresStore<T> {
  const { toRow, toDomain } = createDefaultMappers(Ctor)
  return new PostgresStore(db, table, toRow, toDomain)
}

export function customStore<T extends { readonly id: string }, Row extends Record<string, unknown>>(
  db: StoreDatabase,
  table: StoreTable,
  toRow: (entity: T) => Row,
  toDomain: (row: Row) => T,
): PostgresStore<T, Row> {
  return new PostgresStore(db, table, toRow, toDomain)
}
