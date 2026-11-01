import type { CommandAuditFact, CommandJournalPort, CommandOutboxFact, CommandReceipt, CommandReceiptScope } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

/** No root connection: journal writes cannot accidentally escape their business transaction. */
export class PostgresCommandJournal implements CommandJournalPort {
  private async query<T>(query: SQL): Promise<T[]> {
    const tx = transactionContext.getStore() as { execute: (query: SQL) => Promise<unknown> } | undefined
    if (!tx)
      throw new Error('Command journal requires an active business transaction')
    const result = await tx.execute(query)
    return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]
  }

  async find(scope: CommandReceiptScope): Promise<CommandReceipt | undefined> {
    const [row] = await this.query<CommandReceipt>(sql`
      SELECT id, school_id AS "schoolId", command, caller_id AS "callerId", request_id AS "requestId",
        request_digest AS "requestDigest", result_mode AS "resultMode", status, result
      FROM command_receipts WHERE school_id = ${scope.schoolId} AND command = ${scope.command}
        AND caller_id = ${scope.callerId} AND request_id = ${scope.requestId}`)
    return row
  }

  async claim(receipt: CommandReceipt): Promise<void> {
    await this.query(sql`INSERT INTO command_receipts
      (id, school_id, command, caller_id, request_id, request_digest, result_mode, status)
      VALUES (${receipt.id}, ${receipt.schoolId}, ${receipt.command}, ${receipt.callerId},
        ${receipt.requestId}, ${receipt.requestDigest}, ${receipt.resultMode}, 'claimed')`)
  }

  async complete(receipt: CommandReceipt, audit: readonly CommandAuditFact[], outbox: readonly CommandOutboxFact[]): Promise<void> {
    const updated = await this.query(sql`UPDATE command_receipts
      SET status = 'completed', result = ${JSON.stringify(receipt.result)}::jsonb, completed_at = NOW()
      WHERE id = ${receipt.id} AND school_id = ${receipt.schoolId} AND command = ${receipt.command}
        AND caller_id = ${receipt.callerId} AND request_id = ${receipt.requestId}
        AND request_digest = ${receipt.requestDigest} AND result_mode = ${receipt.resultMode} AND status = 'claimed'
      RETURNING id`)
    if (updated.length !== 1)
      throw new Error('Command receipt completion requires its original claim')
    for (const fact of audit) {
      await this.query(sql`INSERT INTO command_audit (id, receipt_id, school_id, caller_id, event, resource_type, resource_id)
        VALUES (${crypto.randomUUID()}, ${receipt.id}, ${receipt.schoolId}, ${receipt.callerId},
          ${fact.event}, ${fact.resourceType}, ${fact.resourceId})`)
    }
    for (const fact of outbox) {
      await this.query(sql`INSERT INTO command_outbox (id, receipt_id, school_id, kind, version, resource_type, resource_id)
        VALUES (${fact.id}, ${receipt.id}, ${receipt.schoolId}, ${fact.kind}, ${fact.version}, ${fact.resourceType}, ${fact.resourceId})`)
    }
  }
}
