import type { AutoBillingPort, AutoBillingRun } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { transactionContext } from '../lib/transaction'

interface Executor { execute: (query: SQL) => Promise<unknown> }
export class PostgresAutoBilling implements AutoBillingPort {
  constructor(private readonly db: Executor) {}
  private async query<T>(statement: SQL): Promise<T[]> {
    const executor = transactionContext.getStore() as Executor | undefined ?? this.db
    const result = await executor.execute(statement)
    return (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[]
  }

  async save(run: AutoBillingRun): Promise<void> {
    if (!transactionContext.getStore())
      throw new Error('Auto billing writes require an active business transaction')
    await this.query(sql`INSERT INTO auto_billing_runs (id, school_id, catalog_service_id, status, created_at, payload)
      VALUES (${run.id}, ${run.schoolId}, ${run.catalogServiceId}, ${run.status}, ${run.createdAt}::timestamptz, ${JSON.stringify(run)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET status=excluded.status, payload=excluded.payload
      WHERE auto_billing_runs.school_id=excluded.school_id AND auto_billing_runs.catalog_service_id=excluded.catalog_service_id`)
  }

  async get(schoolId: string, id: string): Promise<AutoBillingRun | undefined> {
    const rows = await this.query<{ payload: AutoBillingRun }>(sql`SELECT payload FROM auto_billing_runs WHERE school_id=${schoolId} AND id=${id}`)
    return rows[0]?.payload
  }

  async listForFee(schoolId: string, catalogServiceId: string, limit = 50): Promise<AutoBillingRun[]> {
    const rows = await this.query<{ payload: AutoBillingRun }>(sql`SELECT payload FROM auto_billing_runs
      WHERE school_id=${schoolId} AND catalog_service_id=${catalogServiceId}
      ORDER BY CASE WHEN status='completed' THEN 1 ELSE 0 END, created_at DESC, id DESC LIMIT ${Math.max(1, Math.min(limit, 100))}`)
    return rows.map(row => row.payload)
  }

  async candidates(schoolId: string, academicYearId: string, afterStudentId: string, limit: number): Promise<string[]> {
    const rows = await this.query<{ id: string }>(sql`SELECT DISTINCT s.id FROM students s
      JOIN student_class_enrollments e ON e.student_id=s.id
      JOIN class_groups c ON c.id=e.class_group_id AND c.school_id=s.school_id AND c.academic_year_id=e.academic_year_id
      WHERE s.school_id=${schoolId} AND e.academic_year_id=${academicYearId} AND e.status='active' AND s.id>${afterStudentId}
      ORDER BY s.id LIMIT ${Math.max(1, Math.min(limit, 100))}`)
    return rows.map(row => row.id)
  }
}
