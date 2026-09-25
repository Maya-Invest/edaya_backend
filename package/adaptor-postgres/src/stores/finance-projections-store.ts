/* eslint-disable dot-notation -- SQL result and filter dictionaries have explicit index signatures. */
import type { FinanceProjectionPort, ResourceAccessScope, SchoolFinanceAging } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { BusinessRuleViolationError } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { chargeAgingCtes } from '../lib/charge-aging'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { studentCharges } from '../postgres-schema'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
export class PostgresFinanceProjections implements FinanceProjectionPort {
  constructor(private readonly db: Executor) {}
  async aging(input: { schoolId: string, academicYearId?: string, currency: string, referenceDate: Date }, scope: ResourceAccessScope): Promise<SchoolFinanceAging> {
    if (scope.schoolId !== input.schoolId)
      throw new BusinessRuleViolationError('SCHOOL_MISMATCH', 'Finance projection school must match its access scope')
    const db = transactionContext.getStore() as Executor | undefined ?? this.db
    const sources = chargeAgingCtes(sql`select * from ${studentCharges} where ${compileResourceAccess(studentCharges, scope)} ${input.academicYearId ? sql`and ${studentCharges.academicYearId} = ${input.academicYearId}` : sql``}`, input.referenceDate)
    // One statement keeps totals and the explicitly requested overdue detail in one snapshot.
    const result = await db.execute(sql`with ${sources} select
      (select count(*) from charges where currency <> ${input.currency}) as mismatches,
      (select count(*) from overdue) as overdue_count,
      (select coalesce(sum(amount), 0) from overdue) as overdue_amount,
      (select coalesce(sum(greatest(0,expected_amount-adjustment_amount-waiver_amount-allocated_amount)),0) from charges where status <> 'cancelled') as outstanding,
      (select coalesce(jsonb_agg(jsonb_build_object('chargeId',c.id,'studentId',c.student_id,'label',c.label,'overdueAmount',o.amount,'remainingAmount',greatest(0,c.expected_amount-c.adjustment_amount-c.waiver_amount-c.allocated_amount),'dueDate',c.due_date) order by c.id),'[]'::jsonb) from overdue o join charges c on c.id=o.id) as charges
    `)
    const row = result.rows[0]!
    if (Number(row['mismatches']))
      throw new BusinessRuleViolationError('CURRENCY_MISMATCH', 'Financial records must use the configured school currency')
    const charges = row['charges'] as Array<Omit<SchoolFinanceAging['charges'][number], 'dueDate'> & { dueDate: string | null }>
    return { schoolId: input.schoolId, academicYearId: input.academicYearId, currency: input.currency, overdueCount: Number(row['overdue_count']), overdueAmount: Number(row['overdue_amount']), outstandingAmount: Number(row['outstanding']), charges: charges.map(charge => ({ ...charge, dueDate: charge.dueDate ? new Date(charge.dueDate).toISOString() : undefined })) }
  }
}
