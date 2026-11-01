/* eslint-disable dot-notation -- SQL dictionaries. */
import type { FinanceReadInput, FinanceReadScopes } from '@edaya/core'
import { BusinessRuleViolationError } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { chargeAgingCtes } from '../lib/charge-aging'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { payments, studentCharges, studentYearAccounts } from '../postgres-schema'

export function financeReadCtes(input: FinanceReadInput, scopes: FinanceReadScopes) {
  if (Object.values(scopes).some(scope => scope.schoolId !== input.schoolId))
    throw new BusinessRuleViolationError('SCHOOL_MISMATCH', 'Finance access scope must match the selected school')
  return sql`${chargeAgingCtes(sql`select * from ${studentCharges} where ${compileResourceAccess(studentCharges, scopes.charges)} and ${studentCharges.academicYearId}=${input.academicYearId}`, input.referenceDate)},
    accounts as (select * from ${studentYearAccounts} where ${compileResourceAccess(studentYearAccounts, scopes.accounts)} and ${studentYearAccounts.academicYearId}=${input.academicYearId}),
    receipts as (select * from ${payments} where ${compileResourceAccess(payments, scopes.payments)} and ${payments.academicYearId}=${input.academicYearId}),
    balances as (select c.*, e.catalog_service_id,
      (select ce.class_group_id from student_class_enrollments ce where ce.student_id=c.student_id and ce.academic_year_id=c.academic_year_id and ce.status='active' order by ce.enrollment_index desc,ce.id limit 1) as class_id,
      coalesce(s.first_name || ' ' || s.last_name, c.student_id) as student_name,
      a.id as account_id, coalesce(a.available_balance,0) as available_credit,
      case when c.status='cancelled' then 0 else greatest(0,c.expected_amount-c.adjustment_amount-c.waiver_amount) end as net_amount,
      case when c.status='cancelled' then 0 else greatest(0,c.expected_amount-c.adjustment_amount-c.waiver_amount-c.allocated_amount) end as remaining,
      case when c.status='cancelled' then 0 else least(coalesce(o.amount,0),greatest(0,c.expected_amount-c.adjustment_amount-c.waiver_amount-c.allocated_amount)) end as overdue
      from charges c
      left join student_service_enrollments e on e.id=c.enrollment_id and e.school_id=c.school_id
      left join students s on s.id=c.student_id and s.school_id=c.school_id
      left join accounts a on a.student_id=c.student_id and a.academic_year_id=c.academic_year_id
      left join overdue o on o.id=c.id)
  `
}

export function financeFilters(input: FinanceReadInput, payment = false) {
  const source = payment ? sql`r` : sql`b`
  const search = input.search?.trim()
  return sql`true
    ${input.studentId ? sql`and ${source}.student_id=${input.studentId}` : sql``}
    ${payment && input.paymentId ? sql`and r.id=${input.paymentId}` : sql``}
    ${!payment && input.feeId ? sql`and b.catalog_service_id=${input.feeId}` : sql``}
    ${!payment && input.chargeId ? sql`and b.id=${input.chargeId}` : sql``}
    ${input.status ? sql`and ${source}.status=${input.status}` : sql``}
    ${!payment && input.dueFrom ? sql`and b.due_date::date>=${input.dueFrom}::date` : sql``}
    ${!payment && input.dueTo ? sql`and b.due_date::date<=${input.dueTo}::date` : sql``}
    ${!payment && input.due === 'outstanding' ? sql`and b.remaining>0` : sql``}
    ${!payment && input.due === 'overdue' ? sql`and b.overdue>0` : sql``}
    ${search ? sql`and (${source}.student_name ilike ${`%${search}%`} or ${payment ? sql`coalesce(r.reference,'')` : sql`b.label`} ilike ${`%${search}%`})` : sql``}
    ${input.classGroupId ? sql`and exists (select 1 from student_class_enrollments ce where ce.student_id=${source}.student_id and ce.academic_year_id=${input.academicYearId} and ce.class_group_id=${input.classGroupId} and ce.status='active')` : sql``}
  `
}

export function financeOrder(input: FinanceReadInput, payment = false) {
  const columns = payment
    ? { student: 'student_name', paymentDate: 'payment_date', amount: 'amount', status: 'status' }
    : { student: 'student_name', label: 'label', net: 'net_amount', applied: 'allocated_amount', remaining: 'remaining', dueDate: 'due_date', status: 'status' }
  const key = input.sort as keyof typeof columns
  return sql`${sql.identifier(columns[key] ?? (payment ? 'payment_date' : 'due_date'))} ${input.direction === 'asc' ? sql`asc` : sql`desc`} nulls last, id asc`
}

const FINANCE_TIMESTAMPS = new Set(['createdAt', 'updatedAt', 'adjustedAt', 'waivedAt', 'cancelledAt', 'paymentDate', 'reversedAt', 'dueDate'])

export function financeJsonRows<T>(rows: unknown): T[] {
  return (rows as Record<string, unknown>[]).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => {
    const name = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase())
    // PostgreSQL timestamp columns store UTC without a suffix; JSON aggregation bypasses the normal Date mapper.
    const normalized = FINANCE_TIMESTAMPS.has(name) && typeof value === 'string'
      ? new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value) ? value : `${value}Z`).toISOString()
      : value
    return [name, normalized]
  })) as T)
}

export function assertFinanceCurrency(row: Record<string, unknown>) {
  if (Number(row['mismatches']))
    throw new BusinessRuleViolationError('CURRENCY_MISMATCH', 'Financial records must use the configured school currency')
}

export function financeCurrencyCheck(input: FinanceReadInput) {
  return sql`(select count(*) from (select currency from charges union all select currency from accounts union all select currency from receipts) all_records where currency<>${input.currency}) as mismatches`
}
