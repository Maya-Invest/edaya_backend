import { GuardianCapability } from '../capabilities/guardian-capability'
import { StudentCapability } from '../capabilities/student-capability'
import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const FinanceOperations = defineOperationFamily({
  feeCatalogRead: {
    id: 'finance.fee-catalog.read',
    staff: {
      anyOf: [
        { permission: Permission.FINANCIAL_CONFIG_READ },
        { permission: Permission.PAYMENT_READ },
      ],
    },
    guardian: { capability: GuardianCapability.ReadPayments },
    student: { capability: StudentCapability.ReadPayments },
  },
  feeConfigure: {
    id: 'finance.fee.configure',
    staff: { permission: Permission.FINANCIAL_CONFIG_CONFIGURE },
  },
  paymentsRead: {
    id: 'finance.payments.read',
    staff: { permission: Permission.PAYMENT_READ },
    guardian: { capability: GuardianCapability.ReadPayments, target: 'student' },
    student: { capability: StudentCapability.ReadPayments },
  },
  paymentRecord: {
    id: 'finance.payments.record',
    staff: { permission: Permission.PAYMENT_RECORD },
  },
  paymentCancel: {
    id: 'finance.payments.cancel',
    staff: { permission: Permission.PAYMENT_CANCEL },
  },
  paymentReverse: {
    id: 'finance.payments.reverse',
    staff: { permission: Permission.PAYMENT_REVERSE },
  },
})
