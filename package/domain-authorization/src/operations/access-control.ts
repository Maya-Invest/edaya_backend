import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const AccessControlOperations = defineOperationFamily({
  read: {
    id: 'access-control.read',
    global: true,
    staff: { permission: Permission.ACCESS_CONTROL_READ },
  },
  assign: {
    id: 'access-control.assign',
    global: true,
    staff: { permission: Permission.ACCESS_CONTROL_ASSIGN },
  },
})
