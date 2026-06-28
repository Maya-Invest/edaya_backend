import type { NotificationGatewayPort } from '../ports/notification-gateway'

export const noOpNotificationGateway: NotificationGatewayPort = {
  enqueue: async () => {},
  cancel: async () => {},
  upsertRecipient: async () => {},
  removeRecipient: async () => {},
  registerPushDevice: async () => {},
  unregisterPushDevice: async () => {},
}
