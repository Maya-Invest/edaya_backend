import type { CoreEntityRepositories } from '@edaya/core'
import { BusinessRuleViolationError } from '@edaya/core'

export async function requireSchoolCurrency(repositories: Pick<CoreEntityRepositories, 'schools'>, schoolId: string): Promise<string> {
  const currency = (await repositories.schools.findById(schoolId))?.financeCurrency
  if (!currency)
    throw new BusinessRuleViolationError('SCHOOL_CURRENCY_REQUIRED', 'Configure the school currency before using finance')
  return currency
}

export function assertCurrencyAgreement(expected: string, currencies: readonly string[]): void {
  if (currencies.some(currency => currency !== expected))
    throw new BusinessRuleViolationError('CURRENCY_MISMATCH', 'Financial records must use the configured school currency')
}

export async function assertSchoolCurrency(repositories: Pick<CoreEntityRepositories, 'schools'>, schoolId: string, currency: string): Promise<void> {
  assertCurrencyAgreement(await requireSchoolCurrency(repositories, schoolId), [currency])
}
