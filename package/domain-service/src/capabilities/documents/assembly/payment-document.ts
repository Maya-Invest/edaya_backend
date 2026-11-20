import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  isAllocationActive,
  PaymentKind,
  PaymentStatus,
} from '@edaya/core'
import { assertCurrencyAgreement } from '../../finance/school-currency'

import { formatDocumentDate, formatDocumentMoney } from '../document-format'
import { fail } from './shared'

export async function assemblePaymentDocument(
  base: DocumentAssemblyContext<'allocations' | 'payments' | 'studentYearAccounts' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const payment = await base.repositories.payments.findById(input.sourceId)
  if (!payment || payment.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Payment was not found')
  if (payment.kind !== PaymentKind.Receipt || payment.status !== PaymentStatus.Recorded)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'A receipt proves money received on a recorded receipt only')
  const account = await base.repositories.studentYearAccounts.findById(payment.accountId)
  if (!school.financeCurrency)
    fail('SCHOOL_CURRENCY_REQUIRED', 'Configure the school currency before issuing financial documents')
  assertCurrencyAgreement(school.financeCurrency, [payment.amount.currency, ...(account ? [account.currency] : [])])
  const student = account ? await base.repositories.students.findById(account.studentId) : undefined
  if (!student)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Payment student was not found')
  const allocations = await base.repositories.allocations.list({ causedByPaymentId: payment.id })
  const active = allocations.filter(allocation => isAllocationActive(allocation, allocations))
  if (input.templateKey === 'settlement-quittance.v1' && active.length === 0)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'A settlement quittance identifies settled obligations via allocations')
  const paragraphs = input.templateKey === 'receipt.v1'
    ? [{ text: locale.startsWith('en')
        ? `Received ${formatDocumentMoney(payment.amount.amount, payment.amount.currency, locale)} on ${formatDocumentDate(payment.paymentDate, locale, timeZone)}. This receipt does not state that every charge is settled.`
        : `Reçu ${formatDocumentMoney(payment.amount.amount, payment.amount.currency, locale)} le ${formatDocumentDate(payment.paymentDate, locale, timeZone)}. Cette quittance ne déclare pas que toutes les charges sont soldées.` }]
    : [{ text: locale.startsWith('en')
        ? `Settlements below identify allocated obligations. They do not imply that unrelated charges are paid.`
        : `Les imputations ci-dessous identifient les obligations réglées. Elles n'impliquent pas que les autres charges sont soldées.` }]
  const rows = active.map(allocation => ({
    cells: [allocation.chargeId, formatDocumentMoney(allocation.amount.amount, payment.amount.currency, locale)],
  }))
  const sourceVersion = `${payment.id}:${payment.status}:${payment.amount.amount}:${active.map(allocation => allocation.id).sort().join(',')}`
  return {
    academicYearId: payment.academicYearId,
    sourceType: DocumentSourceType.Payment,
    sourceId: payment.id,
    sourceVersion,
    studentId: account?.studentId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: input.templateKey,
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        date: formatDocumentDate(payment.paymentDate, locale, timeZone),
        paragraphs,
        columns: locale.startsWith('en') ? ['Charge', 'Allocated'] : ['Charge', 'Imputé'],
        rows,
        notes: payment.reference,
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      currency: payment.amount.currency,
      ...branding,
    },
  }
}
