/* eslint-disable dot-notation -- SQL result and filter dictionaries have explicit index signatures. */
import type { FinanceBillingRow, FinanceOverview, FinancePaymentRow, FinanceProjectionPort, FinanceReadInput, FinanceReadScopes, ResourceAccessScope, SchoolFinanceAging } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { BusinessRuleViolationError } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { chargeAgingCtes } from '../lib/charge-aging'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { transactionContext } from '../lib/transaction'
import { studentCharges } from '../postgres-schema'

import { assertFinanceCurrency, financeCurrencyCheck, financeFilters, financeJsonRows, financeOrder, financeReadCtes } from './finance-read-model'

interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }
export class PostgresFinanceProjections implements FinanceProjectionPort {
  constructor(private readonly db: Executor) {}
  async overview(input: FinanceReadInput, scopes: FinanceReadScopes): Promise<FinanceOverview> {
    const db = transactionContext.getStore() as Executor | undefined ?? this.db
    const result = await db.execute(sql`with ${financeReadCtes(input, scopes)}, selected as (select * from balances b where ${financeFilters(input)})
      select ${financeCurrencyCheck(input)},
      (select coalesce(sum(amount),0) from receipts where kind='receipt' and status='recorded') as received,
      (select coalesce(sum(amount),0) from receipts where kind='disbursement' and status='recorded') as refunded,
      (select coalesce(sum(available_balance),0) from accounts) as available,
      (select coalesce(sum(remaining),0) from selected) as outstanding,
      (select coalesce(sum(overdue),0) from selected) as overdue,
      (select count(distinct student_id) from selected where overdue>0) as overdue_students,
      (select count(distinct student_id) from selected where status<>'cancelled') as assigned,
      (select coalesce(sum(net_amount),0) from selected) as billed,
      (select coalesce(sum(allocated_amount),0) from selected where status<>'cancelled') as applied`)
    const row = result.rows[0]!
    assertFinanceCurrency(row)
    // Account receipts and unused credit cannot be attributed to a fee.
    const received = input.feeId ? 0 : Number(row['received'])
    const refunded = input.feeId ? 0 : Number(row['refunded'])
    return { schoolId: input.schoolId, academicYearId: input.academicYearId, currency: input.currency, scope: 'authorized', received, refunded, netCollected: received - refunded, availableCredit: input.feeId ? 0 : Number(row['available']), outstanding: Number(row['outstanding']), overdue: Number(row['overdue']), overdueStudents: Number(row['overdue_students']), studentsAssigned: Number(row['assigned']), netBilled: Number(row['billed']), applied: Number(row['applied']) }
  }

  async billingPage(input: FinanceReadInput, scopes: FinanceReadScopes) {
    const db = transactionContext.getStore() as Executor | undefined ?? this.db
    const result = await db.execute(sql`with ${financeReadCtes(input, scopes)}, filtered as (select * from balances b where ${financeFilters(input)}), page as (select * from filtered order by ${financeOrder(input)} limit ${Math.min(100, Math.max(1, input.limit ?? 50))} offset ${Math.max(0, input.offset ?? 0)})
      select ${financeCurrencyCheck(input)}, (select count(*) from filtered) as total, (select coalesce(jsonb_agg(to_jsonb(page)), '[]'::jsonb) from page) as rows`)
    const row = result.rows[0]!
    assertFinanceCurrency(row)
    return { rows: financeJsonRows<FinanceBillingRow>(row['rows']), total: Number(row['total']) }
  }

  async paymentsPage(input: FinanceReadInput, scopes: FinanceReadScopes) {
    const db = transactionContext.getStore() as Executor | undefined ?? this.db
    const result = await db.execute(sql`with ${financeReadCtes(input, scopes)}, labeled as (select p.*, (select ce.class_group_id from student_class_enrollments ce where ce.student_id=a.student_id and ce.academic_year_id=p.academic_year_id and ce.status='active' order by ce.enrollment_index desc,ce.id limit 1) as class_id, exists(select 1 from allocations al join charges ac on ac.id=al.charge_id where al.caused_by_payment_id=p.id and al.kind='settle' and not exists(select 1 from allocations rev where rev.reverses_allocation_id=al.id)) as has_active_allocations, a.student_id, coalesce(s.first_name || ' ' || s.last_name,a.student_id) as student_name from receipts p join accounts a on a.id=p.account_id left join students s on s.id=a.student_id and s.school_id=a.school_id), filtered as (select * from labeled r where ${financeFilters(input, true)}), page as (select * from filtered order by ${financeOrder(input, true)} limit ${Math.min(100, Math.max(1, input.limit ?? 50))} offset ${Math.max(0, input.offset ?? 0)})
      select ${financeCurrencyCheck(input)}, (select count(*) from filtered) as total, (select coalesce(jsonb_agg(to_jsonb(page)), '[]'::jsonb) from page) as rows`)
    const row = result.rows[0]!
    assertFinanceCurrency(row)
    return { rows: financeJsonRows<FinancePaymentRow>(row['rows']), total: Number(row['total']) }
  }

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
