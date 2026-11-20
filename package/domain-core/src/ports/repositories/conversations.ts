import type { z } from 'zod'
import type { Conversation, ConversationCollectionScope, ConversationMessage, ConversationPlacement, ConversationReadScope, conversationsQuerySchema } from '../../domain/messaging/conversation'

/** Message content is available only through a policy-produced scope; no generic CRUD. */
export interface ConversationsPort {
  placements: (schoolId: string) => Promise<ConversationPlacement[]>
  placement: (schoolId: string, id: string) => Promise<ConversationPlacement | undefined>
  find: (scope: ConversationReadScope, id: string) => Promise<Conversation | undefined>
  unreadCount: (scope: ConversationCollectionScope) => Promise<number>
  unresolvedCount: (scope: ConversationCollectionScope) => Promise<number>
  list: (scope: ConversationReadScope | ConversationCollectionScope, input: z.infer<typeof conversationsQuerySchema>) => Promise<{ items: Array<Conversation & { unread: boolean }>, total: number, unreadCount: number }>
  messages: (scope: ConversationReadScope, id: string, beforeSequence: number | undefined, limit: number) => Promise<ConversationMessage[]>
  save: (conversation: Conversation) => Promise<void>
  append: (message: ConversationMessage) => Promise<void>
  markRead: (scope: ConversationReadScope, id: string, throughSequence: number) => Promise<void>
  unread: (scope: ConversationReadScope, id: string) => Promise<boolean>
}
