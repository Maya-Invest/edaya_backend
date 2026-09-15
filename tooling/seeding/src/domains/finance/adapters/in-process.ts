import type { SeedApplication } from '../../../support/types'
import type { FinanceSeedPort, PaymentAllocationSeedRecord } from '../port'
import { createInProcessSeedService } from '../../../support/in-process-seed-service'
import { withSeedPortError } from '../../../support/seed-port-error'

function asDate(value: string | undefined): Date | undefined {
  return value ? new Date(value) : undefined
}

export function createInProcessFinanceSeedPort(
  application: SeedApplication,
): FinanceSeedPort {
  const service = createInProcessSeedService(application, 'dev-finance-seed')

  return {
    createCatalogService: record => withSeedPortError('finance.createCatalogService', async () => {
      await service.financeWorkflow.createCatalogService({
        ...record,
        billingTerms: {
          kind: 'one_time',
          installments: record.billingTerms.installments.map(installment => ({
            label: installment.label,
            percentage: installment.percentage,
            dueDate: asDate(installment.dueDate),
          })),
          singleDueDate: asDate(record.billingTerms.singleDueDate),
        },
      })
    }),
    enrollStudentInService: record => withSeedPortError('finance.enrollStudentInService', async () => {
      await service.financeWorkflow.enrollStudentInService({
        id: record.id,
        studentId: record.studentId,
        catalogServiceId: record.catalogServiceId,
        priceOverride: record.priceOverride,
        dueDate: asDate(record.dueDate),
      })
    }),
    recordPayment: record => withSeedPortError('finance.recordPayment', async () => {
      await service.financeWorkflow.recordPayment({
        id: record.id,
        studentId: record.studentId,
        academicYearId: record.academicYearId,
        accountId: record.accountId,
        amount: record.amount,
        paymentDate: new Date(record.paymentDate),
        method: record.method,
        reference: record.reference,
        notes: record.notes,
        allocation: record.allocation,
      })
    }),
    waiveStudentCharge: record => withSeedPortError('finance.waiveStudentCharge', async () => {
      await service.financeWorkflow.waiveStudentCharge(record)
    }),
    cancelStudentCharge: record => withSeedPortError('finance.cancelStudentCharge', async () => {
      await service.financeWorkflow.cancelStudentCharge(record)
    }),
    listPaymentAllocations: input => withSeedPortError('finance.listPaymentAllocations', async () => {
      const history = await service.financeWorkflow.getPaymentSettlementHistory({ accountId: input.accountId })
      return history.allocations
        .filter(allocation => allocation.kind === 'settle' && allocation.causedByPaymentId === input.paymentId)
        .map((allocation): PaymentAllocationSeedRecord => ({
          id: allocation.id,
          chargeId: allocation.chargeId,
          causedByPaymentId: allocation.causedByPaymentId,
          kind: allocation.kind,
        }))
    }),
    reverseAllocation: record => withSeedPortError('finance.reverseAllocation', async () => {
      await service.financeWorkflow.reverseAllocation(record)
    }),
    reversePayment: record => withSeedPortError('finance.reversePayment', async () => {
      await service.financeWorkflow.reversePayment({
        paymentId: record.paymentId,
        reverseAllocationIds: record.reverseAllocationIds,
      })
    }),
    refundAvailableBalance: record => withSeedPortError('finance.refundAvailableBalance', async () => {
      await service.financeWorkflow.refundAvailableBalance({
        id: record.id,
        accountId: record.accountId,
        amount: record.amount,
        paymentDate: new Date(record.paymentDate),
        method: record.method,
        reference: record.reference,
        notes: record.notes,
      })
    }),
  }
}
