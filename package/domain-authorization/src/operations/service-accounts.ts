import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const ServiceAccountOperations = defineOperationFamily({
  read: {
    id: 'service-accounts.read',
    global: true,
    staff: { permission: Permission.SERVICE_ACCOUNT_READ },
  },
  create: {
    id: 'service-accounts.create',
    global: true,
    staff: { permission: Permission.SERVICE_ACCOUNT_CREATE },
  },
  update: {
    id: 'service-accounts.update',
    global: true,
    staff: { permission: Permission.SERVICE_ACCOUNT_UPDATE },
  },
  revoke: {
    id: 'service-accounts.revoke',
    global: true,
    staff: { permission: Permission.SERVICE_ACCOUNT_REVOKE },
  },
  rotateKey: {
    id: 'service-accounts.rotate-key',
    global: true,
    staff: { permission: Permission.SERVICE_ACCOUNT_ROTATE_KEY },
  },
})
