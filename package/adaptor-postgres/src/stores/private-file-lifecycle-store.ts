import type { PrivateFileLifecycleStore, PrivateFileObject, PrivateFileReference } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { BusinessRuleViolationError } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface Executor { execute: (query: SQL) => Promise<unknown> }

export class PostgresPrivateFileLifecycleStore implements PrivateFileLifecycleStore {
  constructor(private readonly db: Executor) {}

  private async query<T>(statement: SQL, write = false): Promise<T[]> {
    const tx = transactionContext.getStore() as Executor | undefined
    if (write && !tx)
      throw new Error('Private file lifecycle writes require a transaction')
    try {
      const result = await (tx ?? this.db).execute(statement)
      return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]
    }
    catch {
      throw new Error('PRIVATE_FILE_STORE_UNAVAILABLE')
    }
  }

  private map(row: PrivateFileObject): PrivateFileObject {
    return { ...row, protectedUntil: row.protectedUntil === null ? null : new Date(row.protectedUntil), deleteJobId: row.deleteJobId ?? undefined }
  }

  private assertSource(reference: Pick<PrivateFileReference, 'sourceType' | 'sourceId' | 'slot'>) {
    if (!/^capability\.[a-z][a-z0-9.-]{0,80}$/.test(reference.sourceType) || !reference.sourceId.trim() || !reference.slot.trim())
      throw new BusinessRuleViolationError('PRIVATE_FILE_REFERENCE_INVALID', 'Capability references require a named source and slot')
  }

  async retain(reference: PrivateFileReference): Promise<void> {
    this.assertSource(reference)
    await this.query(sql`INSERT INTO private_file_references (source_type, source_id, slot, school_id, attachment_id, storage_key)
      VALUES (${reference.sourceType}, ${reference.sourceId}, ${reference.slot}, ${reference.schoolId}, ${reference.attachmentId ?? null}, ${reference.storageKey ?? null})
      ON CONFLICT (school_id, source_type, source_id, slot) DO UPDATE SET attachment_id = excluded.attachment_id, storage_key = excluded.storage_key
      WHERE private_file_references.school_id = excluded.school_id RETURNING source_id`, true).then((rows) => {
      if (!rows.length)
        throw new BusinessRuleViolationError('PRIVATE_FILE_REFERENCE_INVALID', 'The reference source is unavailable')
    })
  }

  async release(reference: Pick<PrivateFileReference, 'schoolId' | 'sourceType' | 'sourceId' | 'slot'>): Promise<void> {
    this.assertSource(reference)
    await this.query(sql`DELETE FROM private_file_references WHERE school_id = ${reference.schoolId}
      AND source_type = ${reference.sourceType} AND source_id = ${reference.sourceId} AND slot = ${reference.slot}`, true)
  }

  async assertRemovable(schoolId: string, attachmentId: string): Promise<void> {
    const existing = await this.query<{ fileUrl: string | null, storageKey: string | null }>(sql`SELECT file_url AS "fileUrl", storage_key AS "storageKey" FROM attachments WHERE school_id = ${schoolId} AND id = ${attachmentId} FOR UPDATE`, true)
    if (!existing.length)
      throw new BusinessRuleViolationError('ATTACHMENT_NOT_FOUND', 'Attachment is unavailable')
    if (existing[0]!.fileUrl && existing[0]!.storageKey)
      throw new BusinessRuleViolationError('ATTACHMENT_LEGACY_ALIAS', 'Migrate external attachment aliases before removal')
    const references = await this.query(sql`SELECT 1 FROM private_file_references WHERE attachment_id = ${attachmentId} LIMIT 1`)
    if (references.length)
      throw new BusinessRuleViolationError('ATTACHMENT_REFERENCED', 'Remove the attachment reference before deleting the attachment')
  }

  async reserve(input: { schoolId: string, storageKey: string, protectedUntil: Date }): Promise<PrivateFileObject> {
    if (!input.storageKey || !Number.isFinite(input.protectedUntil.getTime()) || input.protectedUntil.getTime() <= Date.now())
      throw new BusinessRuleViolationError('PRIVATE_FILE_RESERVATION_INVALID', 'An object write requires a future protection window')
    await this.query(sql`SELECT pg_advisory_xact_lock(hashtextextended('private-file-key:' || private_file_key_family(${input.storageKey}), 0))`, true)
    const [row] = await this.query<PrivateFileObject>(sql`
      INSERT INTO private_file_objects (id, school_id, storage_key, protected_until)
      SELECT ${crypto.randomUUID()}, ${input.schoolId}, ${input.storageKey}, ${input.protectedUntil}
      WHERE NOT EXISTS (SELECT 1 FROM private_file_objects WHERE storage_key <> ${input.storageKey}
        AND private_file_key_family(storage_key) = private_file_key_family(${input.storageKey}))
      ON CONFLICT (storage_key) DO UPDATE SET protected_until = GREATEST(private_file_objects.protected_until, excluded.protected_until)
        WHERE private_file_objects.school_id = excluded.school_id AND private_file_objects.status = 'reserved'
      RETURNING id, school_id AS "schoolId", storage_key AS "storageKey", status, CASE WHEN isfinite(protected_until) THEN protected_until END AS "protectedUntil", delete_job_id AS "deleteJobId"`, true)
    if (!row)
      throw new BusinessRuleViolationError('PRIVATE_FILE_UNAVAILABLE', 'Object identity is unavailable for publication')
    return this.map(row)
  }

  async expedite(schoolId: string, storageKey: string): Promise<void> {
    await this.query(sql`UPDATE private_file_objects SET protected_until = clock_timestamp()
      WHERE school_id = ${schoolId} AND storage_key = ${storageKey} AND status = 'reserved' AND NOT legacy_alias_held`, true)
  }

  async listDue(schoolId: string, limit: number): Promise<PrivateFileObject[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error('Private file cleanup batches must be bounded by 100')
    const rows = await this.query<PrivateFileObject>(sql`SELECT id, school_id AS "schoolId", storage_key AS "storageKey", status,
      CASE WHEN isfinite(protected_until) THEN protected_until END AS "protectedUntil", delete_job_id AS "deleteJobId" FROM private_file_objects
      WHERE school_id = ${schoolId} AND status IN ('reserved', 'deleted') AND protected_until <= clock_timestamp()
        AND NOT private_file_object_is_referenced(storage_key)
      ORDER BY protected_until, id LIMIT ${limit}`)
    return rows.map(row => this.map(row))
  }

  async prepareDeletion(schoolId: string, id: string, jobId: string): Promise<boolean> {
    // Serialize aliases before locking the object, matching reservation/reference lock order.
    const [target] = await this.query<{ storageKey: string }>(sql`SELECT storage_key AS "storageKey" FROM private_file_objects WHERE school_id = ${schoolId} AND id = ${id}`, true)
    if (!target)
      return false
    await this.query(sql`SELECT pg_advisory_xact_lock(hashtextextended('private-file-key:' || private_file_key_family(${target.storageKey}), 0))`, true)
    const [candidate] = await this.query<{ storageKey: string }>(sql`SELECT storage_key AS "storageKey" FROM private_file_objects
      WHERE school_id = ${schoolId} AND id = ${id} AND status IN ('reserved', 'deleted')
        AND protected_until <= clock_timestamp() FOR UPDATE`, true)
    if (!candidate)
      return false
    const rows = await this.query(sql`UPDATE private_file_objects SET status = 'deleting', delete_job_id = ${jobId}
      WHERE school_id = ${schoolId} AND id = ${id} AND NOT private_file_object_is_referenced(storage_key) RETURNING id`, true)
    return rows.length === 1
  }

  async findDeletion(schoolId: string, id: string, jobId: string): Promise<PrivateFileObject | undefined> {
    const [row] = await this.query<PrivateFileObject>(sql`SELECT id, school_id AS "schoolId", storage_key AS "storageKey", status,
      CASE WHEN isfinite(protected_until) THEN protected_until END AS "protectedUntil", delete_job_id AS "deleteJobId" FROM private_file_objects
      WHERE school_id = ${schoolId} AND id = ${id} AND delete_job_id = ${jobId} AND status IN ('deleting', 'deleted')
        AND NOT private_file_object_is_referenced(storage_key)`)
    return row ? this.map(row) : undefined
  }

  async completeDeletion(schoolId: string, id: string, jobId: string): Promise<void> {
    const rows = await this.query(sql`UPDATE private_file_objects SET status = 'deleted', deleted_at = clock_timestamp(),
      protected_until = clock_timestamp() + INTERVAL '1 day'
      WHERE school_id = ${schoolId} AND id = ${id} AND delete_job_id = ${jobId} AND status = 'deleting'
        AND NOT private_file_object_is_referenced(storage_key) RETURNING id`, true)
    if (!rows.length) {
      const current = await this.findDeletion(schoolId, id, jobId)
      if (current?.status !== 'deleted')
        throw new Error('PRIVATE_FILE_DELETION_CONFLICT')
    }
  }
}
