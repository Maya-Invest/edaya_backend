import type { ImportBatch, ImportExecutionOutcome, ImportFileRevision, ImportIdentity, ImportPersistencePort, ImportProgress, ImportReadTarget, ImportRow, ImportRowQuery, ImportType } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { BusinessRuleViolationError, IMPORT_COMPLETED_OUTCOMES, IMPORT_TEMPLATES } from '@edaya/core'
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

  async queryRows(schoolId: string, batchId: string, query: ImportRowQuery) {
    if (!Number.isInteger(query.limit) || query.limit < 1 || query.limit > 10000)
      throw new Error('Import row page size is invalid')
    if (query.ids && !query.ids.length)
      return []
    const completed = sql.join(IMPORT_COMPLETED_OUTCOMES.map(value => sql`${value}`), sql`, `)
    const dependencies = query.ready || query.dependencyBlocked
      ? sql`AND ${query.dependencyBlocked ? sql`EXISTS` : sql`NOT EXISTS`} (
      SELECT 1 FROM jsonb_array_elements_text(r.data->'dependencies') dependency(id)
      LEFT JOIN school_import_rows parent ON parent.school_id = r.school_id AND parent.batch_id = r.batch_id AND parent.id = dependency.id
      WHERE parent.id IS NULL OR parent.outcome NOT IN (${completed}${query.dependencyBlocked ? sql`, 'pending'` : sql``})
    )`
      : sql``
    return (await this.query<{ data: ImportRow }>(sql`SELECT r.data FROM school_import_rows r
      WHERE r.school_id = ${schoolId} AND r.batch_id = ${batchId}
      ${query.ids ? sql`AND r.id IN (${sql.join(query.ids.map(id => sql`${id}`), sql`, `)})` : sql``}
      ${query.outcome ? sql`AND r.outcome = ${query.outcome}` : sql``}
      ${query.after ? sql`AND r.id > ${query.after}` : sql``} ${dependencies}
      ORDER BY ${query.ready ? sql`r.execution_rank,` : sql``} r.id LIMIT ${query.limit}`)).map(row => row.data)
  }

  async pendingClassCohort(schoolId: string, batchId: string, classGroupId: string) {
    return this.query<{ id: string, targetId: string }>(sql`SELECT id, data->>'targetId' AS "targetId" FROM school_import_rows
      WHERE school_id = ${schoolId} AND batch_id = ${batchId} AND outcome = 'pending' AND class_group_id = ${classGroupId}
      AND data->>'type' = 'students' AND data->'current'->>'classGroupId' IS DISTINCT FROM class_group_id
      AND NOT (data->'current' <> 'null'::jsonb AND data->>'effectiveMode' = 'S')`)
  }

  async progress(schoolId: string, batchId: string): Promise<ImportProgress> {
    const row = (await this.query<{ counts: Record<string, number>, version: number, updatedAt: string | Date | null }>(sql`
      SELECT counts, progress_version AS version, progress_at AS "updatedAt" FROM school_import_batches WHERE school_id = ${schoolId} AND id = ${batchId}`))[0]
    if (!row)
      throw new Error('Import batch not found')
    return { ...row, updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null }
  }

  async readTargets(schoolId: string, batchId: string): Promise<ImportReadTarget[]> {
    return this.query<ImportReadTarget>(sql`SELECT data->>'type' AS type, data->>'targetId' AS "targetId",
      COALESCE((SELECT jsonb_agg(DISTINCT jsonb_build_object('key', CASE ref.key WHEN 'studentId' THEN 'students' WHEN 'guardianId' THEN 'guardians' WHEN 'teacherId' THEN 'teachers' ELSE 'classGroups' END, 'id', ref.value))
        FROM jsonb_array_elements(jsonb_build_array(data->'current', data->'proposed')) snapshot(value)
        CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(snapshot.value) = 'object' THEN snapshot.value ELSE '{}'::jsonb END) ref
        WHERE ref.key IN ('studentId','guardianId','teacherId','classGroupId') AND jsonb_typeof(ref.value) = 'string'), '[]'::jsonb) AS references,
      CASE WHEN jsonb_typeof(data->'proposed'->'studentIds') = 'array' THEN data->'proposed'->'studentIds' ELSE '[]'::jsonb END AS "studentIds"
      FROM school_import_rows WHERE school_id = ${schoolId} AND batch_id = ${batchId}`)
  }

  async exhaustedBatches(limit: number) {
    return (await this.query<{ data: ImportBatch }>(sql`SELECT b.data FROM school_import_batches b
      JOIN command_outbox w ON w.id = b.data->>'workId' AND w.school_id = b.school_id
      WHERE b.data->>'state' = 'running' AND w.status = 'dead' ORDER BY b.school_id, b.id LIMIT ${limit}`)).map(row => row.data)
  }

  async saveRows(rows: readonly ImportRow[]) {
    // Lock metadata before reading old values: retries and concurrent saves cannot double-count.
    const batches = new Map<string, ImportRow[]>()
    for (const row of rows) {
      const key = JSON.stringify([row.schoolId, row.batchId])
      const group = batches.get(key) ?? []
      group.push(row)
      batches.set(key, group)
    }
    for (const [, entries] of [...batches].sort(([a], [b]) => a.localeCompare(b))) {
      const { schoolId, batchId } = entries[0]!
      const metadata = (await this.query<{ counts: Record<string, number> }>(sql`SELECT counts FROM school_import_batches WHERE school_id = ${schoolId} AND id = ${batchId} FOR UPDATE`))[0]!
      const counts = { ...metadata.counts }
      const count = (row: Pick<ImportRow, 'outcome' | 'result'>, sign: number) => {
        counts[row.outcome] = (counts[row.outcome] ?? 0) + sign
        for (const [key, value] of Object.entries(row.result ?? {})) {
          if (typeof value === 'number')
            counts[key] = (counts[key] ?? 0) + sign * value
        }
      }
      let changed = false
      for (let offset = 0; offset < entries.length; offset += 200) {
        const chunk = entries.slice(offset, offset + 200)
        const previous = await this.query<{ id: string, outcome: ImportRow['outcome'], result: ImportRow['result'], same: boolean }>(sql`
          SELECT r.id, r.outcome, r.data->'result' AS result, r.data = next.value AS same
          FROM school_import_rows r JOIN jsonb_array_elements(${JSON.stringify(chunk)}::jsonb) next(value) ON r.id = next.value->>'id'
          WHERE r.school_id = ${schoolId} AND r.batch_id = ${batchId}`)
        const old = new Map(previous.map(row => [row.id, row]))
        for (const row of chunk) {
          const before = old.get(row.id)
          if (before?.same)
            continue
          changed = true
          if (before)
            count(before, -1)
          count(row, 1)
        }
        await this.query(sql`INSERT INTO school_import_row_revisions (school_id, batch_id, row_id, revision_id, data)
          SELECT value->>'schoolId', value->>'batchId', value->>'id', value->'source'->>'revisionId', value
          FROM jsonb_array_elements(${JSON.stringify(chunk)}::jsonb)
          ON CONFLICT (school_id, batch_id, row_id, revision_id) DO NOTHING`)
        await this.query(sql`INSERT INTO school_import_rows (school_id, batch_id, id, data, execution_rank)
          SELECT value->>'schoolId', value->>'batchId', value->>'id', value, (ranks.mapping->>(value->>'type'))::integer
          FROM jsonb_array_elements(${JSON.stringify(chunk)}::jsonb), (SELECT ${JSON.stringify(Object.fromEntries(Object.entries(IMPORT_TEMPLATES).map(([key, value]) => [key, value.rank])))}::jsonb AS mapping) ranks
          ON CONFLICT (school_id, batch_id, id) DO UPDATE SET data = EXCLUDED.data, execution_rank = EXCLUDED.execution_rank
          WHERE school_import_rows.data IS DISTINCT FROM EXCLUDED.data`)
      }
      if (changed) {
        const zeroKeys = Object.keys(counts).filter(key => counts[key] === 0)
        if (zeroKeys.length) {
          // A reported numeric zero remains meaningful; vanished outcome buckets do not.
          const present = await this.query<{ key: string }>(sql`SELECT DISTINCT result.key FROM school_import_rows r
            CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(r.data->'result') = 'object' THEN r.data->'result' ELSE '{}'::jsonb END) result
            WHERE r.school_id = ${schoolId} AND r.batch_id = ${batchId} AND jsonb_typeof(result.value) = 'number'
            AND result.key IN (${sql.join(zeroKeys.map(key => sql`${key}`), sql`, `)})`)
          const retained = new Set(present.map(row => row.key))
          for (const key of zeroKeys) {
            if (!retained.has(key))
              delete counts[key]
          }
        }
        await this.query(sql`UPDATE school_import_batches SET counts = ${JSON.stringify(counts)}::jsonb,
          progress_version = progress_version + 1, progress_at = clock_timestamp() WHERE school_id = ${schoolId} AND id = ${batchId}`)
      }
    }
  }

  async getIdentity(schoolId: string, type: ImportType, sourceKey: string) {
    return (await this.query<ImportIdentity>(sql`SELECT school_id AS "schoolId", type, source_key AS "sourceKey", target_id AS "targetId", bound
      FROM school_import_identities WHERE school_id = ${schoolId} AND type = ${type} AND source_key = ${sourceKey}`))[0]
  }

  async getIdentities(schoolId: string, type: ImportType, sourceKeys: readonly string[]) {
    const keys = [...new Set(sourceKeys)]
    const identities: ImportIdentity[] = []
    for (let offset = 0; offset < keys.length; offset += 200) {
      identities.push(...await this.query<ImportIdentity>(sql`SELECT school_id AS "schoolId", type, source_key AS "sourceKey", target_id AS "targetId", bound
        FROM school_import_identities WHERE school_id = ${schoolId} AND type = ${type}
        AND source_key IN (${sql.join(keys.slice(offset, offset + 200).map(key => sql`${key}`), sql`, `)})`))
    }
    return identities
  }

  async saveIdentity(identity: ImportIdentity) {
    await this.saveIdentities([identity])
  }

  async saveIdentities(identities: readonly ImportIdentity[]) {
    for (let offset = 0; offset < identities.length; offset += 200) {
      const chunk = identities.slice(offset, offset + 200)
      const saved = await this.query(sql`INSERT INTO school_import_identities (school_id, type, source_key, target_id, bound)
        SELECT value->>'schoolId', value->>'type', value->>'sourceKey', value->>'targetId', (value->>'bound')::boolean
        FROM jsonb_array_elements(${JSON.stringify(chunk)}::jsonb)
        ON CONFLICT (school_id, type, source_key) DO UPDATE SET target_id = EXCLUDED.target_id, bound = school_import_identities.bound OR EXCLUDED.bound
        WHERE school_import_identities.target_id = EXCLUDED.target_id OR NOT school_import_identities.bound RETURNING target_id`)
      if (saved.length !== chunk.length)
        throw new BusinessRuleViolationError('IMPORT_IDENTITY_CONFLICT', 'IMPORT_IDENTITY_CONFLICT')
    }
  }

  async findOutcome(schoolId: string, batchId: string, rowId: string, inputDigest: string) {
    return (await this.query<{
      data: ImportExecutionOutcome
    }>(sql`SELECT data FROM school_import_outcomes
      WHERE school_id = ${schoolId} AND batch_id = ${batchId} AND row_id = ${rowId} AND input_digest = ${inputDigest}`))[0]?.data
  }

  async findOutcomes(schoolId: string, batchId: string, requests: readonly { rowId: string, inputDigest: string }[]) {
    const outcomes: ImportExecutionOutcome[] = []
    const unique = [...new Map(requests.map(request => [JSON.stringify([request.rowId, request.inputDigest]), request])).values()]
    for (let offset = 0; offset < unique.length; offset += 200) {
      outcomes.push(...(await this.query<{ data: ImportExecutionOutcome }>(sql`SELECT o.data FROM school_import_outcomes o
        JOIN jsonb_array_elements(${JSON.stringify(unique.slice(offset, offset + 200))}::jsonb) request(value)
          ON o.row_id = request.value->>'rowId' AND o.input_digest = request.value->>'inputDigest'
        WHERE o.school_id = ${schoolId} AND o.batch_id = ${batchId}`)).map(row => row.data))
    }
    return outcomes
  }

  async addOutcome(outcome: ImportExecutionOutcome) {
    await this.addOutcomes([outcome])
  }

  async addOutcomes(outcomes: readonly ImportExecutionOutcome[]) {
    for (let offset = 0; offset < outcomes.length; offset += 200) {
      await this.query(sql`INSERT INTO school_import_outcomes (school_id, batch_id, row_id, operation_id, input_digest, data)
        SELECT value->>'schoolId', value->>'batchId', value->>'rowId', value->>'operationId', value->>'inputDigest', value
        FROM jsonb_array_elements(${JSON.stringify(outcomes.slice(offset, offset + 200))}::jsonb)`)
    }
  }
}
