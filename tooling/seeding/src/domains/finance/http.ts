import type { HttpSeedClient } from '../../http/client'
import type { CoreHttpRequestOptions } from '../../http/core-entity'
import type { FinanceSeedPort } from './port'
import { postCoreCommand } from '../../http/core-entity'
import { withSeedPortError } from '../../support/seed-port-error'

export interface CreateHttpFinanceSeedPortOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
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
    createFee: record => withSeedPortError('finance.createFee', async () => {
      await postCoreCommand(requestOptions, 'createFee', record)
    }),
    assignFeeToStudent: record => withSeedPortError('finance.assignFeeToStudent', async () => {
      await postCoreCommand(requestOptions, 'assignFeeToStudent', record)
    }),
    recordPayment: record => withSeedPortError('finance.recordPayment', async () => {
      await postCoreCommand(requestOptions, 'recordPayment', record)
    }),
  }
}
