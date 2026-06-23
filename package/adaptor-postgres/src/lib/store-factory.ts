import { PostgresStore } from '../postgres-store'
import { createDefaultMappers } from './mappers'

export function defaultStore<T extends { readonly id: string }>(
  db: any,
  table: any,
  Ctor: new (args: any) => T,
): PostgresStore<T> {
  const { toRow, toDomain } = createDefaultMappers(Ctor)
  return new PostgresStore(db, table, toRow, toDomain)
}

export function customStore<T extends { readonly id: string }>(
  db: any,
  table: any,
  toRow: (entity: T) => any,
  toDomain: (row: any) => T,
): PostgresStore<T> {
  return new PostgresStore(db, table, toRow, toDomain)
}
