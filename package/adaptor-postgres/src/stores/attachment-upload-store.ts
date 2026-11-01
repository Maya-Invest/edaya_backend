import type { AttachmentUploadIntent, AttachmentUploadStore } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { Attachment, BusinessRuleViolationError } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface Executor { execute: (query: SQL) => Promise<unknown> }

export class PostgresAttachmentUploadStore implements AttachmentUploadStore {
  constructor(private readonly db: Executor) {}

  private async query<T>(query: SQL, write = false): Promise<T[]> {
    const tx = transactionContext.getStore() as Executor | undefined
    if (write && !tx)
      throw new Error('Attachment upload writes require a business transaction')
    try {
      const result = await (tx ?? this.db).execute(query)
      return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]
    }
    catch {
      throw new Error('ATTACHMENT_UPLOAD_STORE_UNAVAILABLE')
    }
  }

  async find(schoolId: string, attachmentId: string): Promise<AttachmentUploadIntent | undefined> {
    const [row] = await this.query<AttachmentUploadIntent>(sql`SELECT
      attachment_id AS "attachmentId", school_id AS "schoolId", caller_id AS "callerId", attachment,
      expires_at AS "expiresAt", completed_storage_key AS "completedStorageKey", checksum
      FROM attachment_uploads WHERE school_id = ${schoolId} AND attachment_id = ${attachmentId}`)
    return row ? { ...row, attachment: new Attachment(row.attachment).data, expiresAt: new Date(row.expiresAt), completedStorageKey: row.completedStorageKey ?? undefined, checksum: row.checksum ?? undefined } : undefined
  }

  async create(intent: AttachmentUploadIntent): Promise<void> {
    const rows = await this.query(sql`INSERT INTO attachment_uploads (attachment_id, school_id, caller_id, attachment, expires_at)
      VALUES (${intent.attachmentId}, ${intent.schoolId}, ${intent.callerId}, ${JSON.stringify(intent.attachment)}::jsonb, ${intent.expiresAt})
      ON CONFLICT DO NOTHING RETURNING attachment_id`, true)
    if (rows.length !== 1)
      throw new BusinessRuleViolationError('ATTACHMENT_UPLOAD_CONFLICT', 'Attachment identity is unavailable')
  }

  async findPendingByStorageKey(storageKey: string): Promise<AttachmentUploadIntent | undefined> {
    const [row] = await this.query<{ schoolId: string, attachmentId: string }>(sql`SELECT school_id AS "schoolId", attachment_id AS "attachmentId"
      FROM attachment_uploads WHERE attachment->>'storageKey' = ${storageKey}
      AND completed_at IS NULL AND expires_at > clock_timestamp()`)
    return row ? this.find(row.schoolId, row.attachmentId) : undefined
  }

  async complete(schoolId: string, attachmentId: string, storageKey: string, checksum: string): Promise<void> {
    const rows = await this.query(sql`UPDATE attachment_uploads
      SET completed_storage_key = ${storageKey}, checksum = ${checksum}, completed_at = clock_timestamp()
      WHERE school_id = ${schoolId} AND attachment_id = ${attachmentId}
        AND completed_at IS NULL AND expires_at > clock_timestamp() RETURNING attachment_id`, true)
    if (rows.length !== 1)
      throw new Error('ATTACHMENT_UPLOAD_COMPLETION_CONFLICT')
  }
}
