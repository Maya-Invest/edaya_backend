import type { BaseRepositoryInterface, Filter, QueryOptions, ResourceAccessScope } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { AuthorizationError, AuthorizationErrorCode } from '@edaya/authorization'
import { DomainValidationError } from '@edaya/core'
import { and, asc, desc, eq, getTableColumns, inArray, sql } from 'drizzle-orm'
import {
  batchSaveChunkSize,
  buildConflictUpdateSet,
  chunkArray,
} from './lib/bulk-upsert'
import { buildWhereClause } from './lib/filter'
import { withPrivateFileConstraintErrors } from './lib/private-file-errors'
import { compileResourceAccess } from './lib/resource-access-scope'
import { schoolScope } from './lib/school-scope'
import { PostgresAtomicExecution, transactionContext } from './lib/transaction'

export class PostgresStore<T extends { readonly id: string }>
implements BaseRepositoryInterface<T> {
  constructor(
    private readonly db: any,
    private readonly table: any,
    private readonly toRow: (entity: T) => any,
    private readonly toDomain: (row: any) => T,
  ) {}

  protected schoolId?: string
  protected accessScope?: ResourceAccessScope

  forAccess(scope: ResourceAccessScope): BaseRepositoryInterface<T> {
    const scoped = this.forSchool(scope.schoolId) as this
    compileResourceAccess(this.table, scope)
    scoped.accessScope = scope
    return scoped
  }

  async assertAccess(entity: T): Promise<void> {
    if (!this.accessScope)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    const result = await this.getClient().execute(sql`select 1 where ${compileResourceAccess(this.table, this.accessScope, this.toRow(entity))}`)
    if (result.rows.length !== 1)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  forSchool(schoolId: string): BaseRepositoryInterface<T> {
    if (!schoolId || (this.schoolId && this.schoolId !== schoolId))
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    schoolScope(this.table, schoolId) // Fail closed for an unclassified table.
    const scoped = Object.assign(Object.create(Object.getPrototypeOf(this)), this) as this
    scoped.schoolId = schoolId
    return scoped
  }

  protected scopedWhere(filter?: SQL): SQL | undefined {
    return and(filter, this.accessScope ? compileResourceAccess(this.table, this.accessScope) : this.schoolId ? schoolScope(this.table, this.schoolId) : undefined)
  }

  protected getClient() {
    const tx = transactionContext.getStore()
    return tx ?? this.db
  }

  async findById(id: string): Promise<T | undefined> {
    const rows = await this.getClient()
      .select()
      .from(this.table)
      .where(this.scopedWhere(eq(this.table.id, id)))

    if (rows.length === 0) {
      return undefined
    }
    return this.toDomain(rows[0])
  }

  async findByIds(ids: readonly string[]): Promise<T[]> {
    if (ids.length === 0) {
      return []
    }
    const rows = await this.getClient()
      .select()
      .from(this.table)
      .where(this.scopedWhere(inArray(this.table.id, [...ids])))

    return rows.map((r: any) => this.toDomain(r))
  }

  async findOne(options?: QueryOptions<T>, last?: boolean): Promise<T | undefined> {
    const queryOptions = last ? options : { ...options, $limit: options?.$limit === 0 ? 0 : 1 } as QueryOptions<T>
    const results = await this.list(queryOptions)
    if (results.length === 0) {
      return undefined
    }
    return last ? results[results.length - 1] : results[0]
  }

  async list(options?: QueryOptions<T>): Promise<T[]> {
    let query = this.getClient().select().from(this.table)
    const ordering = options?.$orderBy ?? []
    const columns = getTableColumns(this.table)
    const orderByClauses = ordering.map(({ field, direction }) => {
      const col = columns[field as string]
      if (!col || !['asc', 'desc'].includes(direction))
        throw new DomainValidationError('Invalid query ordering')
      return direction === 'asc' ? asc(col) : desc(col)
    })
    if (!ordering.some(item => item.field === 'id'))
      orderByClauses.push(asc(this.table.id))
    query = query.orderBy(...orderByClauses)

    query = query.where(this.scopedWhere(options ? buildWhereClause(this.table, options) : undefined))
    if (options) {
      if (options.$limit !== undefined) {
        if (!Number.isSafeInteger(options.$limit) || options.$limit < 0)
          throw new DomainValidationError('Query limit must be a non-negative integer')
        query = query.limit(options.$limit)
      }
      if (options.$offset !== undefined) {
        if (!Number.isSafeInteger(options.$offset) || options.$offset < 0)
          throw new DomainValidationError('Query offset must be a non-negative integer')
        query = query.offset(options.$offset)
      }
    }

    const rows = await query
    return rows.map((r: any) => this.toDomain(r))
  }

  async count(filter?: Filter<T>): Promise<number> {
    let query = this.getClient().select({ count: sql<number>`count(*)` }).from(this.table)

    query = query.where(this.scopedWhere(filter ? buildWhereClause(this.table, filter) : undefined))

    const rows = await query
    return Number(rows[0]?.count ?? 0)
  }

  async save(entity: T): Promise<void> {
    const client = this.getClient()
    const row = this.toRow(entity)
    if (this.schoolId) {
      await this.saveScopedRow(row)
      return
    }
    await withPrivateFileConstraintErrors(() => client
      .insert(this.table)
      .values(row)
      .onConflictDoUpdate({
        target: this.table.id,
        set: row,
      }))
  }

  /** One statement checks proposed ownership and conflicting-row ownership. */
  protected async saveScopedRow(row: Record<string, unknown>, immutable: readonly string[] = []): Promise<void> {
    const columns = getTableColumns(this.table)
    const keys = Object.keys(row).filter(key => columns[key] && row[key] !== undefined)
    const fields = sql.join(keys.map(key => sql.identifier(columns[key]!.name)), sql`, `)
    const values = sql.join(keys.map(key => sql`${sql.param(row[key], columns[key])}`), sql`, `)
    const updates = sql.join(keys.filter(key => key !== 'id' && !immutable.includes(key))
      .map(key => sql`${sql.identifier(columns[key]!.name)} = excluded.${sql.identifier(columns[key]!.name)}`), sql`, `)
    const result = await withPrivateFileConstraintErrors(() => this.getClient().execute(sql`
      insert into ${this.table} (${fields}) select ${values}
      where ${this.accessScope ? compileResourceAccess(this.table, this.accessScope, row) : schoolScope(this.table, this.schoolId!, row)}
      on conflict (${sql.identifier(columns.id!.name)}) do update set ${updates}
      where ${this.accessScope ? compileResourceAccess(this.table, this.accessScope) : schoolScope(this.table, this.schoolId!)}
      returning ${this.table.id}
    `))
    if (result.rows.length !== 1)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  async delete(id: string): Promise<void> {
    await withPrivateFileConstraintErrors(() => this.getClient()
      .delete(this.table)
      .where(this.scopedWhere(eq(this.table.id, id))))
  }

  async batchSave(entities: T[]): Promise<string[]> {
    if (entities.length === 0) {
      return []
    }
    if (new Set(entities.map(entity => entity.id)).size !== entities.length)
      throw new DomainValidationError('Batch save requires unique entity IDs')
    if (this.schoolId) {
      return new PostgresAtomicExecution(this.db).execute(async () => {
        for (const entity of entities)
          await this.save(entity)
        return entities.map(entity => entity.id)
      })
    }
    const client = this.getClient()
    const rows = entities.map(entity => this.toRow(entity))
    const columnCount = Object.keys(getTableColumns(this.table)).length
    const chunks = chunkArray(rows, batchSaveChunkSize(columnCount))
    const conflictSet = buildConflictUpdateSet(this.table)

    for (const chunk of chunks) {
      await withPrivateFileConstraintErrors(() => client
        .insert(this.table)
        .values(chunk)
        .onConflictDoUpdate({
          target: this.table.id,
          set: conflictSet,
        }))
    }
    return entities.map(e => e.id)
  }

  async batchDelete(ids: string[]): Promise<void> {
    if (ids.length === 0) {
      return
    }
    await withPrivateFileConstraintErrors(() => this.getClient()
      .delete(this.table)
      .where(this.scopedWhere(inArray(this.table.id, [...ids]))))
  }
}
