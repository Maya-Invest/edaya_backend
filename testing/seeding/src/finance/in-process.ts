import type { SeedApplication } from '../types'
import type { FinanceSeedPort } from './port'
import { createInProcessSeedService } from '../in-process-seed-service'
import { withSeedPortError } from '../seed-port-error'

export function createInProcessFinanceSeedPort(
  application: SeedApplication,
): FinanceSeedPort {
  const service = createInProcessSeedService(application, 'dev-finance-seed')

  return {
    createFee: record => withSeedPortError('finance.createFee', async () => {
      await service.financeWorkflow.createFee({
        ...record,
        installments: record.installments.map(installment => ({
          ...installment,
          dueDate: installment.dueDate ? new Date(installment.dueDate) : undefined,
        })),
      })
    }),
    assignFeeToStudent: record => withSeedPortError('finance.assignFeeToStudent', async () => {
      await service.financeWorkflow.assignFeeToStudent({
        ...record,
        dueDate: new Date(record.dueDate),
        referenceDate: new Date(record.referenceDate),
      })
    }),
    recordPayment: record => withSeedPortError('finance.recordPayment', async () => {
      await service.financeWorkflow.recordPayment({
        ...record,
        paymentDate: new Date(record.paymentDate),
        referenceDate: new Date(record.referenceDate),
      })
    }),
  }
}
