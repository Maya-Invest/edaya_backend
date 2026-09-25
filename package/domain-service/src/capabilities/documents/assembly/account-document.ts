import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import { ChargeStatus, DOCUMENT_FAILURES, DocumentSourceType, overdueInstallmentRemainder, remainingChargeObligation } from '@edaya/core'
import { assertCurrencyAgreement } from '../../finance/school-currency'

import { formatDocumentDate, formatDocumentIsoDate, formatDocumentMoney } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleAccountDocument(
  base: DocumentAssemblyContext<'academicYears' | 'studentCharges' | 'studentYearAccounts' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const account = await base.repositories.studentYearAccounts.findById(input.sourceId)
  if (!account || account.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Student year account was not found')
  const student = await base.repositories.students.findById(account.studentId)
  const year = await requireYear(base, account.academicYearId)
  const charges = await base.repositories.studentCharges.list({ studentId: account.studentId, academicYearId: account.academicYearId })
  if (!school.financeCurrency)
    fail('SCHOOL_CURRENCY_REQUIRED', 'Configure the school currency before issuing financial documents')
  assertCurrencyAgreement(school.financeCurrency, [account.currency, ...charges.map(charge => charge.currency)])
  const referenceDate = new Date()
  const open = charges.filter(charge => remainingChargeObligation(charge) > 0 && charge.status !== ChargeStatus.Cancelled && charge.status !== ChargeStatus.Waived)
  const overdue = open.filter(charge => overdueInstallmentRemainder(charge, charge.allocatedAmount.amount, referenceDate) > 0)
  if (input.templateKey === 'invoice.v1' && open.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'An invoice requires open or due charges')
  if (input.templateKey === 'payment-reminder.v1' && overdue.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'A reminder requires overdue remainders')
  const rowsSource = input.templateKey === 'payment-reminder.v1' ? overdue : input.templateKey === 'invoice.v1' ? open : charges
  const columns = locale.startsWith('en') ? ['Label', 'Due', 'Remaining'] : ['Libellé', 'Échéance', 'Reste']
  const rows = rowsSource.map(charge => ({
    cells: [
      charge.label,
      charge.dueDate ? formatDocumentIsoDate(charge.dueDate, timeZone) : '—',
      formatDocumentMoney(remainingChargeObligation(charge), account.currency, locale),
    ],
  }))
  const notes = input.templateKey === 'account-statement.v1'
    ? (locale.startsWith('en')
        ? `Available balance: ${formatDocumentMoney(account.availableBalance.amount, account.currency, locale)}. An unallocated deposit is not a settlement of every charge.`
        : `Solde disponible : ${formatDocumentMoney(account.availableBalance.amount, account.currency, locale)}. Un dépôt non imputé ne solde pas toutes les charges.`)
    : undefined
  const sourceVersion = `${account.id}:${charges.map(charge => `${charge.id}:${charge.allocatedAmount.amount}:${charge.status}`).sort().join('|')}`
  return {
    academicYearId: account.academicYearId,
    sourceType: DocumentSourceType.StudentYearAccount,
    sourceId: account.id,
    sourceVersion,
    studentId: account.studentId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: input.templateKey,
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student?.fullName,
        schoolYear: year.name,
        date: formatDocumentDate(new Date(), locale, timeZone),
        columns,
        rows,
        notes,
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      currency: account.currency,
      ...branding,
    },
  }
}
