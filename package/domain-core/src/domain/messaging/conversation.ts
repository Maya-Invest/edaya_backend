import { z } from 'zod'

export const CONVERSATION_NOTIFY_KIND = 'conversation.message'

const id = z.string().trim().min(1).max(200)
export const conversationStatusSchema = z.enum(['awaiting_school', 'awaiting_guardian', 'resolved'])
export const conversationSchema = z.object({
  id,
  schoolId: id,
  guardianId: id,
  destination: z.enum(['school', 'teacher']),
  teacherId: id.optional(),
  studentId: id.optional(),
  assignmentIds: z.array(id),
  subject: z.string().trim().min(1).max(200),
  schoolName: z.string(),
  guardianName: z.string(),
  teacherName: z.string().optional(),
  studentName: z.string().optional(),
  status: conversationStatusSchema,
  version: z.number().int().positive(),
  lastSequence: z.number().int().nonnegative(),
  lastMessage: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  awaitingSince: z.string().datetime(),
})
export const conversationMessageSchema = z.object({
  id,
  schoolId: id,
  conversationId: id,
  sequence: z.number().int().positive(),
  authorKind: z.enum(['guardian', 'teacher', 'staff']),
  authorId: id,
  authorSubjectId: id,
  authorName: z.string(),
  body: z.string().trim().min(1).max(10000),
  createdAt: z.string().datetime(),
})
export const startConversationSchema = z.object({
  requestId: id,
  destination: z.enum(['school', 'teacher']),
  teacherId: id.optional(),
  studentId: id.optional(),
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
}).superRefine((input, ctx) => {
  if (input.destination === 'teacher' && (!input.teacherId || !input.studentId))
    ctx.addIssue({ code: 'custom', message: 'Teacher messages require a teacher and child' })
  if (input.destination === 'school' && input.teacherId)
    ctx.addIssue({ code: 'custom', message: 'School enquiries cannot target a teacher' })
})
export const teacherGuardianRecipientsQuerySchema = z.object({ studentId: id, classGroupId: id })
export const startTeacherConversationSchema = teacherGuardianRecipientsQuerySchema.extend({
  guardianId: id,
  requestId: id,
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(10000),
})
export const replyConversationSchema = z.object({ requestId: id, conversationId: id, expectedVersion: z.number().int().positive(), body: z.string().trim().min(1).max(10000) })
export const resolveConversationSchema = replyConversationSchema.omit({ body: true })
export const markConversationReadSchema = z.object({ conversationId: id, throughSequence: z.number().int().nonnegative() })
export const conversationsQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  destination: z.enum(['school', 'teacher']).optional(),
  status: conversationStatusSchema.optional(),
  order: z.enum(['latest', 'oldest_awaiting']).default('latest'),
  offset: z.number().int().nonnegative().default(0),
  limit: z.number().int().min(1).max(100).default(25),
})
export const conversationDetailQuerySchema = z.object({ conversationId: id, beforeSequence: z.number().int().positive().optional(), limit: z.number().int().min(1).max(100).default(50) })
export const conversationRecipientsQuerySchema = z.object({ studentId: id.optional() })
export const conversationActionsSchema = z.object({ reply: z.boolean(), resolve: z.boolean(), reason: z.string().nullable() })
export const conversationSummarySchema = conversationSchema.extend({ unread: z.boolean(), allowedActions: conversationActionsSchema })
export const conversationsPageSchema = z.object({ items: z.array(conversationSummarySchema), total: z.number(), unreadCount: z.number(), offset: z.number(), limit: z.number() })
export const conversationDetailSchema = z.object({ conversation: conversationSummarySchema, messages: z.array(conversationMessageSchema), hasMore: z.boolean() })
export const conversationRecipientsSchema = z.object({ schoolAvailable: z.boolean(), schoolName: z.string(), teachers: z.array(z.object({ id, name: z.string(), subjects: z.array(z.string()) })) })
export type Conversation = z.infer<typeof conversationSchema>
export type ConversationMessage = z.infer<typeof conversationMessageSchema>
export type ConversationPlacement = Pick<Conversation, 'id' | 'schoolId' | 'guardianId' | 'destination' | 'teacherId' | 'studentId' | 'assignmentIds'>
export interface ConversationReadScope { schoolId: string, ids: readonly string[], profileKind: 'guardian' | 'teacher' | 'staff', profileId: string }
