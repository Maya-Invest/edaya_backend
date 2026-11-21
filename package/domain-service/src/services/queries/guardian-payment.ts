import type { GuardianFeesInput, GuardianPaymentInput, GuardianSettlementInput, SettlementBoundary } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess } from '@edaya/authorization'
import { DomainValidationError, guardianFeesQuery, guardianPaymentQuery, guardianSettlementQuery } from '@edaya/core'
import { z } from 'zod'
import { requireSchoolCurrency } from '../../capabilities/finance/school-currency'

async function financeContext(base: BaseSchoolService, input: GuardianFeesInput) {
  if (base.actor.kind !== 'guardian')
    denyResourceAccess()
  const access = base.access.forOperation()
  await access.finance.assertReadStudent(input.studentId)
  const accounts = await access.entity('studentYearAccounts').readScope()
  const charges = await access.entity('studentCharges').readScope()
  const currency = await requireSchoolCurrency(base.repositories, base.actor.schoolId)
  return { access, scopes: { accounts, charges }, currency }
}

export function getGuardianPaymentDetail(base: BaseSchoolService, args: GuardianPaymentInput) {
  const input = guardianPaymentQuery.parse(args)
  return base.atomicExecution.execute(async () => {
    const { access, scopes, currency } = await financeContext(base, input)
    const payments = await access.entity('payments').readScope()
    return base.repositories.financeProjections.guardianPayment(input, currency, { ...scopes, payments })
  }, { readSnapshot: true })
}

export function getGuardianFeesSummary(base: BaseSchoolService, args: GuardianFeesInput) {
  const input = guardianFeesQuery.parse(args)
  return base.atomicExecution.execute(async () => {
    const { scopes, currency } = await financeContext(base, input)
    return base.repositories.financeProjections.guardianFeesSummary(input, currency, scopes, new Date())
  }, { readSnapshot: true })
}

const id = z.string().min(1)
const cursorFields = z.tuple([id, id, id, id.nullable(), z.enum(['charges', 'payments']), z.string().datetime().nullable(), z.string(), id])
function settlementBoundary(input: GuardianSettlementInput, schoolId: string): SettlementBoundary | undefined {
  if (input.cursor === undefined)
    return undefined
  try {
    const [school, pupil, year, accountId, section, date, label, id] = cursorFields.parse(JSON.parse(input.cursor))
    if (school === schoolId && pupil === input.studentId && year === input.academicYearId && (section === 'charges' || date !== null))
      return { accountId, section, date, label, id }
  }
  catch { /* All invalid cursor forms have the same public response. */ }
  throw new DomainValidationError('Invalid settlement history cursor')
}

export function getGuardianSettlements(base: BaseSchoolService, args: GuardianSettlementInput) {
  const input = guardianSettlementQuery.parse(args)
  return base.atomicExecution.execute(async () => {
    const { access, scopes, currency } = await financeContext(base, input)
    const after = settlementBoundary(input, base.actor.schoolId)
    const payments = await access.entity('payments').readScope()
    return base.repositories.financeProjections.guardianSettlements(input, currency, { ...scopes, payments }, after)
  }, { readSnapshot: true })
}
