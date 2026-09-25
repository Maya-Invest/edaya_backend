import type { FixtureDataset, FixturePayment } from '@edaya/fixtures'
import type { FinanceSeedPort } from './port'
import { studentYearAccountId } from '@edaya/core'

export interface DevFinanceSeedCounts {
  catalogServices: number
  studentServiceEnrollments: number
  payments: number
}

function isoDate(value: string | undefined): string | undefined {
  if (!value)
    return undefined
  return value.includes('T') ? value : `${value}T12:00:00.000Z`
}

function paymentAccountId(dataset: FixtureDataset, payment: FixturePayment): string | undefined {
  if (payment.accountId)
    return payment.accountId
  if (!payment.studentId || !payment.academicYearId)
    return undefined
  const currency = dataset.entities.school?.financeCurrency
  if (!currency)
    throw new Error('Seed school must configure financeCurrency')
  return studentYearAccountId(dataset.schoolId, payment.studentId, payment.academicYearId, currency)
}

export async function seedDevFinance(
  port: FinanceSeedPort,
  dataset: FixtureDataset,
): Promise<DevFinanceSeedCounts> {
  if (!dataset.entities.school?.financeCurrency) {
    throw new Error('Seed school must configure financeCurrency before financial seeding')
  }
  const catalogs = dataset.entities.catalogServices ?? []
  const enrollments = dataset.entities.studentServiceEnrollments ?? []
  const payments = dataset.entities.payments ?? []
  let recordedPayments = 0

  for (const catalog of catalogs) {
    await port.createCatalogService({
      id: catalog.id,
      academicYearId: catalog.academicYearId,
      name: catalog.name,
      description: catalog.description,
      category: catalog.category,
      defaultPrice: catalog.defaultPrice,
      currency: catalog.currency,
      billingTerms: {
        kind: 'one_time',
        installments: catalog.billingTerms.installments.map(installment => ({
          label: installment.label,
          percentage: installment.percentage,
          dueDate: isoDate(installment.dueDate),
        })),
        singleDueDate: isoDate(catalog.billingTerms.singleDueDate),
      },
      status: catalog.status,
    })
  }

  for (const enrollment of enrollments) {
    await port.enrollStudentInService({
      id: enrollment.id,
      studentId: enrollment.studentId,
      catalogServiceId: enrollment.catalogServiceId,
      priceOverride: enrollment.priceOverride,
      dueDate: isoDate(enrollment.dueDate),
    })
    if (enrollment.waive) {
      await port.waiveStudentCharge({
        chargeId: enrollment.id,
        reason: enrollment.waive.reason,
        waiverAmount: enrollment.waive.waiverAmount,
      })
    }
    if (enrollment.cancelCharge) {
      await port.cancelStudentCharge({
        chargeId: enrollment.id,
        reason: enrollment.cancelCharge.reason,
      })
    }
  }

  for (const payment of payments) {
    await port.recordPayment({
      id: payment.id,
      studentId: payment.studentId,
      academicYearId: payment.academicYearId,
      accountId: payment.accountId,
      amount: payment.amount,
      paymentDate: isoDate(payment.paymentDate) ?? payment.paymentDate,
      method: payment.method,
      reference: payment.reference,
      notes: payment.notes,
      allocation: payment.allocation,
    })
    recordedPayments += 1
    const accountId = paymentAccountId(dataset, payment)
    if (payment.reverseCausedAllocations && accountId) {
      const allocations = await port.listPaymentAllocations({ accountId, paymentId: payment.id })
      const chargeIds = payment.reverseCausedAllocations === true
        ? undefined
        : new Set(payment.reverseCausedAllocations.chargeIds)
      for (const allocation of allocations) {
        if (chargeIds && !chargeIds.has(allocation.chargeId))
          continue
        await port.reverseAllocation({ allocationId: allocation.id })
      }
    }
    if (payment.reversePayment) {
      await port.reversePayment({ paymentId: payment.id })
    }
    if (payment.refund && accountId) {
      await port.refundAvailableBalance({
        id: payment.refund.id,
        accountId,
        amount: payment.refund.amount,
        paymentDate: isoDate(payment.refund.paymentDate) ?? payment.refund.paymentDate,
        method: payment.refund.method,
        reference: payment.refund.reference,
        notes: payment.refund.notes,
      })
      recordedPayments += 1
    }
  }

  return {
    catalogServices: catalogs.length,
    studentServiceEnrollments: enrollments.length,
    payments: recordedPayments,
  }
}
