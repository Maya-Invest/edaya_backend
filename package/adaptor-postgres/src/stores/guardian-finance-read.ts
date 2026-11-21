/* eslint-disable dot-notation -- SQL result dictionaries have explicit index signatures. */
import type { FinanceReadScopes, GuardianFeesInput, GuardianSettlementInput, SettlementBoundary } from '@edaya/core'
import type { SQL } from 'drizzle-orm'
import { BusinessRuleViolationError, guardianFeesSummary, guardianSettlementPage } from '@edaya/core'
import { sql } from 'drizzle-orm'
import { chargeAgingCtes } from '../lib/charge-aging'
import { compileResourceAccess } from '../lib/resource-access-scope'
import { payments, studentCharges, studentYearAccounts } from '../postgres-schema'
import { assertFinanceCurrency } from './finance-read-model'

type BalanceScopes = Pick<FinanceReadScopes, 'accounts' | 'charges'>
interface Executor { execute: (query: SQL) => Promise<{ rows: Record<string, unknown>[] }> }

export function guardianSources(input: GuardianFeesInput, scopes: BalanceScopes & Partial<Pick<FinanceReadScopes, 'payments'>>) {
  const school = scopes.accounts.schoolId
  if (scopes.charges.schoolId !== school || (scopes.payments && scopes.payments.schoolId !== school))
    throw new BusinessRuleViolationError('SCHOOL_MISMATCH', 'Finance access scopes must belong to the same school')
  const paymentSource = scopes.payments
    ? sql`, visible_payments as not materialized (
      select * from ${payments} where account_id in (select id from accounts) and ${compileResourceAccess(payments, scopes.payments)})`
    : sql``
  return sql`accounts as (select id,currency,available_balance from ${studentYearAccounts}
    where student_id=${input.studentId} and academic_year_id=${input.academicYearId} and ${compileResourceAccess(studentYearAccounts, scopes.accounts)}),
    visible_charges as not materialized (select * from ${studentCharges}
    where student_id=${input.studentId} and academic_year_id=${input.academicYearId} and ${compileResourceAccess(studentCharges, scopes.charges)}) ${paymentSource}`
}

export function guardianCurrencyCheck(currency: string, school: string, withLedger: boolean) {
  const statement = withLedger
    ? sql`or exists(select 1 from visible_payments where currency<>${currency})
    or exists(select 1 from student_account_entries where school_id=${school} and account_id in (select id from accounts) and currency<>${currency})
    or exists(select 1 from allocations where school_id=${school} and account_id in (select id from accounts) and currency<>${currency})`
    : sql``
  return sql`(exists(select 1 from accounts where currency<>${currency}) or exists(select 1 from visible_charges where currency<>${currency}) ${statement})::int as mismatches`
}

export async function readGuardianFeesSummary(db: Executor, input: GuardianFeesInput, currency: string, scopes: BalanceScopes, at: Date) {
  const unpaid = sql`greatest(0,c.expected_amount-c.adjustment_amount-c.waiver_amount-c.allocated_amount)`
  const { rows: [row] } = await db.execute(sql`with ${guardianSources(input, scopes)},
    ${chargeAgingCtes(sql`select * from visible_charges where status<>'cancelled'`, at)}
    select ${guardianCurrencyCheck(currency, scopes.accounts.schoolId, false)},
      (select id from accounts limit 1) as "accountId", coalesce((select available_balance from accounts limit 1),0) as available,
      coalesce(sum(${unpaid}),0)::float8 as outstanding, coalesce(sum(least(${unpaid},coalesce(o.amount,0))),0)::float8 as overdue,
      coalesce(sum(c.expected_amount),0)::float8 as expected, coalesce(sum(c.allocated_amount),0)::float8 as paid,
      count(*) filter(where c.status='overdue')::int as "overdueCount" from charges c left join overdue o on o.id=c.id`)
  assertFinanceCurrency(row!)
  return guardianFeesSummary.parse({ ...row, ...input, currency })
}

const chargeOrder = sql`due_date asc nulls last, (case when due_date is null then label else '' end) collate "C", id collate "C"`
const paymentOrder = sql`payment_date desc, id collate "C" asc`
function chargePage(limit: number, after?: SettlementBoundary) {
  let boundary = sql``
  if (after) {
    boundary = after.date
      ? sql`and (due_date is null or (due_date,id collate "C") > (${after.date}::timestamp,${after.id}))`
      : sql`and due_date is null and (label collate "C",id collate "C") > (${after.label},${after.id})`
  }
  return sql`, charge_candidates as (select * from visible_charges where status<>'cancelled' ${boundary} order by ${chargeOrder} limit ${limit + 1}),
    charge_page as (select * from charge_candidates order by ${chargeOrder} limit ${limit}),
    counts as (select charge_id,count(*)::int as count from allocations where account_id in (select id from accounts)
      and school_id=(select school_id from charge_page limit 1) and kind='settle' and charge_id in (select id from charge_page) group by charge_id)`
}

function paymentPage(limit: number, school: string, year: string, after?: SettlementBoundary) {
  const boundary = after ? sql`and (payment_date < ${after.date}::timestamp or (payment_date=${after.date}::timestamp and id collate "C" > ${after.id}))` : sql``
  return sql`, payment_candidates as (select * from visible_payments where academic_year_id=${year} ${boundary} order by ${paymentOrder} limit ${limit + 1}),
    payment_page as (select * from payment_candidates order by ${paymentOrder} limit ${limit}),
    labels as (select a.caused_by_payment_id,c.label,min(a.id collate "C") as first_id from allocations a
      join payment_page p on p.id=a.caused_by_payment_id and p.account_id=a.account_id
      join lateral (select label from visible_charges where id=a.charge_id and status<>'cancelled' limit 1) c on true
      where a.school_id=${school} and a.kind<>'reverse' and c.label<>'' group by a.caused_by_payment_id,c.label)`
}

export async function readGuardianSettlements(db: Executor, input: GuardianSettlementInput, currency: string, scopes: FinanceReadScopes, after?: SettlementBoundary) {
  const limit = input.limit ?? 30
  const school = scopes.accounts.schoolId
  const charges = after?.section !== 'payments'
  const receipts = after?.section !== 'charges'
  const { rows: [row] } = await db.execute(sql`with ${guardianSources(input, scopes)}
    ${charges ? chargePage(limit, after) : sql``} ${receipts ? paymentPage(limit, school, input.academicYearId, after) : sql``}
    select ${guardianCurrencyCheck(currency, school, true)}, (select id from accounts limit 1) as "accountId",
    ${charges
      ? sql`(select jsonb_agg(jsonb_build_object('id',id,'label',label,'status',status,'currency',currency,'expectedAmount',expected_amount,
      'allocatedAmount',allocated_amount,'waiverAmount',waiver_amount,'adjustmentAmount',adjustment_amount,'settlementCount',coalesce(count,0),
      'dueDate',to_char(due_date,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')) order by ${chargeOrder}) from charge_page left join counts on charge_id=id)`
      : sql`null`} as charges,
    ${receipts
      ? sql`(select jsonb_agg(jsonb_build_object('id',p.id,'currency',currency,'kind',kind,'amount',amount,'reference',reference,
      'method',method,'status',status,'paymentDate',to_char(payment_date,'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
      'chargeLabels',coalesce((select jsonb_agg(label order by first_id collate "C") from labels where caused_by_payment_id=p.id),'[]'::jsonb))
      order by ${paymentOrder}) from payment_page p)`
      : sql`null`} as payments,
    ${charges ? sql`exists(select 1 from charge_candidates offset ${limit})` : sql`false`} as "moreCharges",
    ${receipts ? sql`exists(select 1 from payment_candidates offset ${limit})` : sql`false`} as "morePayments"`)
  assertFinanceCurrency(row!)
  const page = guardianSettlementPage.parse({
    ...input,
    accountId: row!['accountId'],
    currency,
    charges: row!['charges'] ?? [],
    payments: row!['payments'] ?? [],
    nextChargeCursor: null,
    nextPaymentCursor: null,
  })
  if (after && after.accountId !== page.accountId)
    throw new BusinessRuleViolationError('FINANCE_ACCOUNT_CHANGED', 'The selected account changed. Refresh the statement.')
  const prefix = [school, input.studentId, input.academicYearId, page.accountId]
  const charge = page.charges.at(-1)
  const payment = page.payments.at(-1)
  if (row!['moreCharges'] && charge)
    page.nextChargeCursor = JSON.stringify([...prefix, 'charges', charge.dueDate, charge.dueDate ? '' : charge.label, charge.id])
  if (row!['morePayments'] && payment)
    page.nextPaymentCursor = JSON.stringify([...prefix, 'payments', payment.paymentDate, '', payment.id])
  return page
}
