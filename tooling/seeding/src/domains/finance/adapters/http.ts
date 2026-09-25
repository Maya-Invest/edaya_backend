import type { HttpSeedClient } from '../../../transport/http/client'
import type { CoreHttpRequestOptions } from '../../../transport/http/core-entity'
import type { FinanceSeedPort, PaymentAllocationSeedRecord } from '../port'
import { withSeedPortError } from '../../../support/seed-port-error'
import { postCoreCommand, postCoreQuery } from '../../../transport/http/core-entity'

export interface CreateHttpFinanceSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

interface PaymentSettlementHistoryBody {
  allocations?: Array<{
    id: string
    chargeId: string
    causedByPaymentId?: string
    kind: string
  }>
}

export function createHttpFinanceSeedPort(
  options: CreateHttpFinanceSeedPortOptions,
): FinanceSeedPort {
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-finance-seed',
  }

  return {
    createCatalogService: record => withSeedPortError('finance.createCatalogService', async () => {
      await postCoreCommand(requestOptions, 'createCatalogService', record)
    }),
    enrollStudentInService: record => withSeedPortError('finance.enrollStudentInService', async () => {
      await postCoreCommand(requestOptions, 'enrollStudentInService', record)
    }),
    recordPayment: record => withSeedPortError('finance.recordPayment', async () => {
      await postCoreCommand(requestOptions, 'recordPayment', record)
    }),
    waiveStudentCharge: record => withSeedPortError('finance.waiveStudentCharge', async () => {
      await postCoreCommand(requestOptions, 'waiveStudentCharge', { ...record, requestId: `seed-waive:${record.chargeId}` })
    }),
    cancelStudentCharge: record => withSeedPortError('finance.cancelStudentCharge', async () => {
      await postCoreCommand(requestOptions, 'cancelStudentCharge', { ...record, requestId: `seed-cancel:${record.chargeId}` })
    }),
    listPaymentAllocations: input => withSeedPortError('finance.listPaymentAllocations', async () => {
      const history = await postCoreQuery(requestOptions, 'getPaymentSettlementHistory', {
        accountId: input.accountId,
      }) as PaymentSettlementHistoryBody
      return (history.allocations ?? [])
        .filter(allocation => allocation.kind === 'settle' && allocation.causedByPaymentId === input.paymentId)
        .map((allocation): PaymentAllocationSeedRecord => ({
          id: allocation.id,
          chargeId: allocation.chargeId,
          causedByPaymentId: allocation.causedByPaymentId,
          kind: allocation.kind,
        }))
    }),
    reverseAllocation: record => withSeedPortError('finance.reverseAllocation', async () => {
      await postCoreCommand(requestOptions, 'reverseAllocation', record)
    }),
    reversePayment: record => withSeedPortError('finance.reversePayment', async () => {
      await postCoreCommand(requestOptions, 'reversePayment', record)
    }),
    refundAvailableBalance: record => withSeedPortError('finance.refundAvailableBalance', async () => {
      await postCoreCommand(requestOptions, 'refundAvailableBalance', record)
    }),
  }
}
