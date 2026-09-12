import { PlatformPermission } from '../permissions/platform-permission'
import { defineOperationFamily } from './define-operation'

export const PlatformUserOperations = defineOperationFamily({
  read: {
    id: 'platform-users.read',
    global: true,
    platform: { permission: PlatformPermission.PLATFORM_USER_READ },
  },
  create: {
    id: 'platform-users.create',
    global: true,
    platform: { permission: PlatformPermission.PLATFORM_USER_CREATE },
  },
  deactivate: {
    id: 'platform-users.deactivate',
    global: true,
    platform: { permission: PlatformPermission.PLATFORM_USER_DEACTIVATE },
  },
})
