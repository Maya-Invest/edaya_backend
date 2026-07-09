import { Permission } from '../permissions/permission'
import { defineOperationFamily } from './define-operation'

export const ResourceOperations = defineOperationFamily({
  read: {
    id: 'resources.read',
    global: true,
    staff: { permission: Permission.RESOURCE_READ },
  },
  configure: {
    id: 'resources.configure',
    global: true,
    staff: { permission: Permission.RESOURCE_CONFIGURE },
  },
})
