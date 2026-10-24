import type { ImportBatch, ImportExecutionOutcome, ImportFileRevision, ImportIdentity, ImportPersistencePort, ImportRow, ImportType } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { BusinessRuleViolationError } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'
/** Requires a caller transaction: business records, row outcomes and crosswalks commit together. */
export class PostgresImportStore implements ImportPersistencePort {
  private async query<T>(statement: SQL): Promise<T[]> {
    const tx = transactionContext.getStore() as {
      execute: (statement: SQL) => Promise<unknown>
    } | undefined
    if (!tx)
      throw new Error('Import persistence requires an active transaction')
    const result = await tx.execute(statement)
    return (Array.isArray(result)
      ? result
      : (result as {
          rows: T[]
        }).rows) as T[]
  }

  async getBatch(schoolId: string, id: string) {
    return (await this.query<{
      data: ImportBatch
    }>(sql`SELECT data FROM school_import_batches WHERE school_id = ${schoolId} AND id = ${id}`))[0]?.data
  }

  async listBatches(schoolId: string, limit: number, before?: string) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('Import history page size is invalid')
    const cursor = before ? sql`AND (created_at, id) < (SELECT created_at, id FROM school_import_batches WHERE school_id = ${schoolId} AND id = ${before})` : sql``
    return (await this.query<{
      data: ImportBatch
    }>(sql`SELECT data FROM school_import_batches WHERE school_id = ${schoolId} ${cursor} ORDER BY created_at DESC, id DESC LIMIT ${limit}`)).map(row => row.data)
  }

  async saveBatch(batch: ImportBatch) {
    await this.query(sql`INSERT INTO school_import_batches (school_id, id, data, created_at)
      VALUES (${batch.schoolId}, ${batch.id}, ${JSON.stringify(batch)}::jsonb, ${batch.createdAt}::timestamptz)
      ON CONFLICT (school_id, id) DO UPDATE SET data = EXCLUDED.data`)
  }

  async listFiles(schoolId: string, batchId: string) {
    return (await this.query<{
      data: ImportFileRevision
    }>(sql`SELECT data FROM school_import_files WHERE school_id = ${schoolId} AND batch_id = ${batchId} ORDER BY revision, id`)).map(row => row.data)
  }

  async addFile(file: ImportFileRevision) {
    await this.query(sql`INSERT INTO school_import_files (school_id, batch_id, id, file_id, revision, data)
      VALUES (${file.schoolId}, ${file.batchId}, ${file.id}, ${file.fileId}, ${file.revision}, ${JSON.stringify(file)}::jsonb)`)
  }

  async listRows(schoolId: string, batchId: string) {
    return (await this.query<{
      data: ImportRow
    }>(sql`SELECT data FROM school_import_rows WHERE school_id = ${schoolId} AND batch_id = ${batchId} ORDER BY id`)).map(row => row.data)
  }

  async saveRows(rows: readonly ImportRow[]) {
    for (let offset = 0; offset < rows.length; offset += 200) {
      await this.query(sql`INSERT INTO school_import_row_revisions (school_id, batch_id, row_id, revision_id, data)
        SELECT value->>'schoolId', value->>'batchId', value->>'id', value->'source'->>'revisionId', value
        FROM jsonb_array_elements(${JSON.stringify(rows.slice(offset, offset + 200))}::jsonb)
        ON CONFLICT (school_id, batch_id, row_id, revision_id) DO NOTHING`)

      await this.query(sql`INSERT INTO school_import_rows (school_id, batch_id, id, data)
        SELECT value->>'schoolId', value->>'batchId', value->>'id', value
        FROM jsonb_array_elements(${JSON.stringify(rows.slice(offset, offset + 200))}::jsonb)
        ON CONFLICT (school_id, batch_id, id) DO UPDATE SET data = EXCLUDED.data`)
    }
  }

  async getIdentity(schoolId: string, type: ImportType, sourceKey: string) {
    return (await this.query<ImportIdentity>(sql`SELECT school_id AS "schoolId", type, source_key AS "sourceKey", target_id AS "targetId", generated_code AS "generatedCode", bound
      FROM school_import_identities WHERE school_id = ${schoolId} AND type = ${type} AND source_key = ${sourceKey}`))[0]
  }

  async saveIdentity(identity: ImportIdentity) {
    const saved = await this.query(sql`INSERT INTO school_import_identities (school_id, type, source_key, target_id, generated_code, bound)
      VALUES (${identity.schoolId}, ${identity.type}, ${identity.sourceKey}, ${identity.targetId}, ${identity.generatedCode}, ${identity.bound})
      ON CONFLICT (school_id, type, source_key) DO UPDATE SET target_id = EXCLUDED.target_id, bound = school_import_identities.bound OR EXCLUDED.bound, generated_code = COALESCE(school_import_identities.generated_code, EXCLUDED.generated_code)
      WHERE school_import_identities.target_id = EXCLUDED.target_id OR NOT school_import_identities.bound RETURNING target_id`)
    if (saved.length !== 1)
      throw new BusinessRuleViolationError('IMPORT_IDENTITY_CONFLICT', 'IMPORT_IDENTITY_CONFLICT')
  }

  async findOutcome(schoolId: string, batchId: string, rowId: string, inputDigest: string) {
    return (await this.query<{
      data: ImportExecutionOutcome
    }>(sql`SELECT data FROM school_import_outcomes
      WHERE school_id = ${schoolId} AND batch_id = ${batchId} AND row_id = ${rowId} AND input_digest = ${inputDigest}`))[0]?.data
  }

  async addOutcome(outcome: ImportExecutionOutcome) {
    await this.query(sql`INSERT INTO school_import_outcomes (school_id, batch_id, row_id, operation_id, input_digest, data)
      VALUES (${outcome.schoolId}, ${outcome.batchId}, ${outcome.rowId}, ${outcome.operationId}, ${outcome.inputDigest}, ${JSON.stringify(outcome)}::jsonb)`)
  }
}
