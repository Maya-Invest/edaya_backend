import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum MessageDeliveryChannel {
  App = 'app',
  Email = 'email',
  Sms = 'sms',
  WhatsApp = 'whatsapp',
  Other = 'other',
}

export enum MessageDeliveryRecipientKind {
  Staff = 'staff',
  Guardian = 'guardian',
  Student = 'student',
  Teacher = 'teacher',
}

export enum MessageDeliveryStatus {
  Pending = 'pending',
  Sent = 'sent',
  Failed = 'failed',
  Read = 'read',
  Cancelled = 'cancelled',
}

export const messageDeliveryBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  announcementId: z.string().trim().min(1, 'announcementId must not be blank').optional(),
  eventKey: z.string().trim().min(1, 'eventKey must not be blank').optional(),
  sourceKey: z.string().trim().min(1, 'sourceKey must not be blank').optional(),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  body: z.string().min(1, 'body must not be blank'),
  recipientKind: z.nativeEnum(MessageDeliveryRecipientKind).optional(),
  recipientId: z.string().trim().min(1, 'recipientId must not be blank').optional(),
  status: z.nativeEnum(MessageDeliveryStatus).default(MessageDeliveryStatus.Pending),
  providerMessageId: z.string().trim().min(1, 'providerMessageId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  failureReason: z.string().trim().min(1, 'failureReason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  sentAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  readAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

function refineMessageDelivery(data: any, ctx: z.RefinementCtx) {
  if (data.sourceKey && (!data.recipientKind || !data.recipientId)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Sourced deliveries require a recipient profile' })
  }
  if (data.sourceKey && data.announcementId && data.sourceKey !== data.announcementId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Announcement delivery source must match its announcement' })
  }
  if ((data.status === MessageDeliveryStatus.Sent || data.status === MessageDeliveryStatus.Read) && !data.sentAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'sentAt is required for sent or read message deliveries',
    })
  }
  if (data.status === MessageDeliveryStatus.Read && !data.readAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'readAt is required for read message deliveries',
    })
  }
  if (data.status === MessageDeliveryStatus.Failed && !data.failureReason) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'failureReason is required for failed message deliveries',
    })
  }
  if (data.readAt && data.sentAt && data.readAt.getTime() < data.sentAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'readAt must not be before sentAt',
    })
  }
}

export const messageDeliverySchema = messageDeliveryBaseSchema.superRefine(refineMessageDelivery)

export type MessageDeliveryData = z.infer<typeof messageDeliverySchema>
export type MessageDeliveryInput = z.input<typeof messageDeliverySchema>

export const messageDeliveryCreateSchema = messageDeliveryBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineMessageDelivery)
export const messageDeliveryUpdateSchema = messageDeliveryBaseSchema.partial().required({ id: true }).superRefine(refineMessageDelivery)

/**
 * Tracks delivery state for one notification to one selected profile and its linked login account.
 * Ad-hoc announcements link via `announcementId`; system events use `eventKey`.
 */
export class MessageDelivery {
  readonly data: MessageDeliveryData

  constructor(args: MessageDeliveryInput) {
    this.data = parseDomain(messageDeliverySchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get announcementId() { return this.data.announcementId }
  get eventKey() { return this.data.eventKey }
  get sourceKey() { return this.data.sourceKey }
  get subjectId() { return this.data.subjectId }
  get title() { return this.data.title }
  get body() { return this.data.body }
  get recipientKind() { return this.data.recipientKind }
  get recipientId() { return this.data.recipientId }
  get status() { return this.data.status }
  get providerMessageId() { return this.data.providerMessageId }
  get failureReason() { return this.data.failureReason }
  get sentAt() { return this.data.sentAt }
  get readAt() { return this.data.readAt }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}

export interface AnnouncementDeliverySummary {
  total: number
  pending: number
  sent: number
  failed: number
  read: number
  cancelled: number
}

export function buildDeliverySummary(deliveries: MessageDelivery[]): AnnouncementDeliverySummary {
  return deliveries.reduce<AnnouncementDeliverySummary>((summary, delivery) => {
    summary.total += 1
    switch (delivery.status) {
      case MessageDeliveryStatus.Pending:
        summary.pending += 1
        break
      case MessageDeliveryStatus.Sent:
        summary.sent += 1
        break
      case MessageDeliveryStatus.Failed:
        summary.failed += 1
        break
      case MessageDeliveryStatus.Read:
        summary.read += 1
        break
      case MessageDeliveryStatus.Cancelled:
        summary.cancelled += 1
        break
    }
    return summary
  }, { total: 0, pending: 0, sent: 0, failed: 0, read: 0, cancelled: 0 })
}
