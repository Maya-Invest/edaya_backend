import type { FinanceReconciliation, ResourceAccessScope } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { netActiveSettlement, sumEntryBalance } from '@edaya/core'
import { groupByKey, loadInBatches } from '../shared/bounded-reads'
import { assertCurrencyAgreement, requireSchoolCurrency } from './school-currency'

export async function loadFinanceReconciliation(repositories: Pick<SchoolRepositories, 'schools' | 'studentYearAccounts' | 'studentCharges' | 'studentAccountEntries' | 'allocations'>, scopes: { accounts: ResourceAccessScope, charges: ResourceAccessScope }, input: { schoolId: string, academicYearId?: string }): Promise<FinanceReconciliation> {
  const accounts = await repositories.studentYearAccounts.forAccess(scopes.accounts).list({
    ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
  })
  const charges = await repositories.studentCharges.forAccess(scopes.charges).list({
    ...(input.academicYearId ? { academicYearId: input.academicYearId } : {}),
  })
  const currency = await requireSchoolCurrency(repositories, input.schoolId)
  assertCurrencyAgreement(currency, [...accounts.map(row => row.currency), ...charges.map(row => row.currency)])
  const allEntries = await loadInBatches(accounts.map(row => row.id), ids => repositories.studentAccountEntries.forSchool!(input.schoolId).list({ accountId: { $in: ids } }))
  const entriesByAccount = groupByKey(allEntries, row => row.accountId)
  const allAllocations = await loadInBatches(charges.map(row => row.id), ids => repositories.allocations.forSchool!(input.schoolId).list({ chargeId: { $in: ids } }))
  const allocationsByCharge = groupByKey(allAllocations, row => row.chargeId)
  assertCurrencyAgreement(currency, [...allEntries.map(row => row.amount.currency), ...allAllocations.map(row => row.amount.currency)])
  const accountRows = accounts.map((account) => {
    const entries = entriesByAccount.get(account.id) ?? []
    const entrySum = sumEntryBalance(entries)
    return {
      accountId: account.id,
      studentId: account.studentId,
      projectedAvailable: account.availableBalance.amount,
      entrySum,
      difference: account.availableBalance.amount - entrySum,
    }
  })
  const chargeRows = charges.map((charge) => {
    const allocations = allocationsByCharge.get(charge.id) ?? []
    const settlement = netActiveSettlement(allocations, charge.id)
    return {
      chargeId: charge.id,
      studentId: charge.studentId,
      projectedAllocated: charge.allocatedAmount.amount,
      settlement,
      difference: charge.allocatedAmount.amount - settlement,
    }
  })
  return {
    schoolId: input.schoolId,
    academicYearId: input.academicYearId,
    accounts: accountRows,
    charges: chargeRows,
    balanced: accountRows.every(row => row.difference === 0) && chargeRows.every(row => row.difference === 0),
  }
}
