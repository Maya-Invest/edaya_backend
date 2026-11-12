import { conversationDetailSchema, conversationRecipientsSchema, conversationSchema, conversationsPageSchema, markConversationReadSchema, replyConversationSchema, resolveConversationSchema, startConversationSchema, startTeacherConversationSchema, teacherGuardianRecipientsQuerySchema } from "@edaya/core";
import { z } from "@hono/zod-openapi";

export const teacherGuardianQuery = teacherGuardianRecipientsQuerySchema.openapi("TeacherGuardianRecipientsQuery");
export const teacherGuardianResponse = z.object({ guardians: z.array(z.object({ id: z.string(), name: z.string() })) }).openapi("TeacherGuardianRecipientsResponse");
export const startTeacherCommand = startTeacherConversationSchema.openapi("StartTeacherConversationCommand");
export const startConversationCommandSchema = startConversationSchema.openapi("StartConversationCommand");
export const replyConversationCommandSchema = replyConversationSchema.openapi("ReplyConversationCommand");
export const resolveConversationCommandSchema = resolveConversationSchema.openapi("ResolveConversationCommand");
export const markConversationReadCommandSchema = markConversationReadSchema.openapi("MarkConversationReadCommand");
export const conversationResponseSchema = conversationSchema.openapi("ConversationResponse");
export const conversationDetailResponseSchema = conversationDetailSchema.openapi("ConversationDetailResponse");
export const conversationsResponseSchema = conversationsPageSchema.openapi("ConversationsResponse");
export const conversationRecipientsResponseSchema = conversationRecipientsSchema.openapi("ConversationRecipientsResponse");
export const markConversationReadResponseSchema = z.object({ conversationId: z.string(), throughSequence: z.number() }).openapi("MarkConversationReadResponse");
