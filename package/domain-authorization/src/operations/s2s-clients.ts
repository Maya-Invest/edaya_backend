import { PlatformPermission } from '../permissions/platform-permission'
import { defineOperationFamily } from './define-operation'

export const S2sClientOperations = defineOperationFamily({
  read: {
    id: 's2s-clients.read',
    global: true,
    platform: { permission: PlatformPermission.S2S_CLIENT_READ },
  },
  create: {
    id: 's2s-clients.create',
    global: true,
    platform: { permission: PlatformPermission.S2S_CLIENT_CREATE },
  },
  revoke: {
    id: 's2s-clients.revoke',
    global: true,
    platform: { permission: PlatformPermission.S2S_CLIENT_REVOKE },
  },
  rotateKey: {
    id: 's2s-clients.rotate-key',
    global: true,
    platform: { permission: PlatformPermission.S2S_CLIENT_ROTATE_KEY },
  },
})
