import type { ResourceAccessScope } from './resource-access-scope'
import { z } from 'zod'
import { MessageDeliveryStatus } from '../../domain/messaging/message-delivery'

export const deliveryInboxQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().min(1).optional(),
})
export const deliveryInboxRow = z.object({
  id: z.string(),
  title: z.string(),
  preview: z.string(),
  status: z.nativeEnum(MessageDeliveryStatus),
  at: z.string().datetime(),
})
export const deliveryInboxPage = z.object({
  items: deliveryInboxRow.array(),
  unreadCount: z.number().int().nonnegative(),
  nextCursor: z.string().nullable(),
})
export interface DeliveryInboxPort {
  page: (scope: ResourceAccessScope, limit: number, after?: { at: string, id: string }) => Promise<z.infer<typeof deliveryInboxPage>>
}
