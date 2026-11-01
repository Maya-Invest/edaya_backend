import type { AnnouncementInput, AnnouncementTarget, AnnouncementTargetInput, MessageDeliveryRecipientKind, MessageDeliveryStatus, StaffMember } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { CommunicationsWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { denyResourceAccess, isInteractiveActor } from '@edaya/authorization'
import { Announcement, AnnouncementStatus, AnnouncementTarget as AnnouncementTargetEntity, BusinessRuleViolationError, MessageDeliveryStatus as DeliveryStatus, MessageDelivery, StaffMember as StaffMemberEntity } from '@edaya/core'
import { ANNOUNCEMENT_PUBLISHED_EVENT_KEY, buildNotificationDeliveryId, runWorkflowNotifications } from '../../capabilities/notifications'

import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface PublishAnnouncementInput {
  announcementId: string
  publishedAt?: Date
}

export interface PublishAnnouncementOptions {
  deferNotifications?: boolean
}

export interface RecordDeliveryInput {
  id: string
  schoolId: string
  title: string
  body: string
  subjectId: string
  announcementId?: string
  eventKey?: string
  recipientKind?: MessageDeliveryRecipientKind
  recipientId?: string
  status?: MessageDeliveryStatus
  providerMessageId?: string
  failureReason?: string
  sentAt?: Date
  readAt?: Date
  createdAt?: Date
  updatedAt?: Date
}

export interface MaterializeDeliveriesInput {
  announcementId: string
  createdAt?: Date
}

export interface ApplyDeliveryEventInput {
  deliveryId: string
  status: DeliveryStatus.Sent | DeliveryStatus.Failed | DeliveryStatus.Read | DeliveryStatus.Cancelled
  providerMessageId?: string
  failureReason?: string
  occurredAt?: Date
}

export interface MarkDeliveryReadInput {
  deliveryId: string
  readAt?: Date
}

export interface UpdateNotificationContactInput {
  notificationEmail?: string | null
  notificationPhone?: string | null
}

export interface RegisterPushDeviceInput {
  appId: 'teacher' | 'guardian' | 'staff' | 'student'
  installationId: string
  token: string
  provider: 'fcm' | 'apns'
}

export interface UnregisterPushDeviceInput {
  appId: 'teacher' | 'guardian' | 'staff' | 'student'
  installationId: string
  provider: 'fcm' | 'apns'
}

function normalizeNotificationContact(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : undefined
}

export type CreateAnnouncementInput = AnnouncementInput
export type AddAnnouncementTargetInput = AnnouncementTargetInput

const DELIVERY_STATUS_RANK: Record<MessageDeliveryStatus, number> = {
  [DeliveryStatus.Pending]: 0,
  [DeliveryStatus.Failed]: 1,
  [DeliveryStatus.Cancelled]: 1,
  [DeliveryStatus.Sent]: 2,
  [DeliveryStatus.Read]: 3,
}

function buildDeliveryId(schoolId: string, announcementId: string, subjectId: string, recipientKind: MessageDeliveryRecipientKind, recipientId: string): string {
  return buildNotificationDeliveryId(schoolId, announcementId, subjectId, { kind: recipientKind, id: recipientId })
}

function canTransitionDeliveryStatus(
  current: MessageDeliveryStatus,
  next: MessageDeliveryStatus,
): boolean {
  if (current === next) {
    return false
  }
  if (DELIVERY_STATUS_RANK[next] <= DELIVERY_STATUS_RANK[current]) {
    return false
  }
  if (current === DeliveryStatus.Pending) {
    return next === DeliveryStatus.Sent
      || next === DeliveryStatus.Failed
      || next === DeliveryStatus.Cancelled
  }
  if (current === DeliveryStatus.Sent) {
    return next === DeliveryStatus.Read
  }
  return false
}

export class CommunicationsServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: CommunicationsWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('communications', base.repositories)
  }

  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    return this.baseService.atomicExecution.execute(async () => {
      const announcement = new Announcement(input)
      await this.baseService.entities.announcements.save(announcement)
      return announcement
    })
  }

  async addTarget(input: AddAnnouncementTargetInput): Promise<AnnouncementTarget> {
    return this.baseService.atomicExecution.execute(async () => {
      const target = new AnnouncementTargetEntity(input)
      await this.baseService.entities.announcementTargets.save(target)
      return target
    })
  }

  async publishAnnouncement(
    {
      announcementId,
      publishedAt,
    }: PublishAnnouncementInput,
    options?: PublishAnnouncementOptions,
  ): Promise<Announcement> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireAnnouncement(announcementId)
      await this.authorize({ schoolId: existing.schoolId, announcementId })
      if ((await this.repositories.announcementTargets.list({ announcementId })).length === 0) {
        throw new BusinessRuleViolationError('PUBLISH_WITHOUT_TARGETS', `Announcement ${announcementId} must define at least one target before publishing`)
      }
      const announcement = new Announcement({
        id: existing.id,
        schoolId: existing.schoolId,
        title: existing.title,
        content: existing.content,
        createdBy: existing.createdBy,
        priority: existing.priority,
        status: AnnouncementStatus.Published,
        createdAt: existing.createdAt,
        publishedAt: publishedAt ?? new Date(),
        expiresAt: existing.expiresAt,
      })
      await this.baseService.entities.announcements.save(announcement)
      if (!options?.deferNotifications) {
        await this.dispatchPublishedAnnouncementNotifications(announcement.id)
      }
      return announcement
    })
  }

  async dispatchPublishedAnnouncementNotifications(
    announcementId: string,
  ): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      const announcement = await this.requireAnnouncement(announcementId)
      if (!announcement.isPublished) {
        throw new BusinessRuleViolationError(
          'DISPATCH_UNPUBLISHED_ANNOUNCEMENT',
          `Announcement ${announcement.id} must be published before dispatching notifications`,
        )
      }
      const deliveries = await this.materializeAnnouncement(announcement, announcement.publishedAt ?? new Date())
      await runWorkflowNotifications(this.baseService, ANNOUNCEMENT_PUBLISHED_EVENT_KEY, {
        announcement,
        deliveries,
      })
    })
  }

  async recordDelivery({
    id,
    schoolId,
    title,
    body,
    announcementId,
    eventKey,
    subjectId,
    recipientKind,
    recipientId,
    status,
    providerMessageId,
    failureReason,
    sentAt,
    readAt,
    createdAt,
    updatedAt,
  }: RecordDeliveryInput): Promise<MessageDelivery> {
    return this.baseService.atomicExecution.execute(async () => {
      this.checkActorSchool(schoolId)
      if (announcementId) {
        const announcement = await this.requireAnnouncement(announcementId)
        await this.authorize({ schoolId: announcement.schoolId, announcementId })
        if (recipientKind && recipientId) {
          if (!announcement.isPublished) {
            throw new BusinessRuleViolationError('RECORD_DELIVERY_UNPUBLISHED', `Announcement ${announcementId} must be published before recording delivery`)
          }
          await this.baseService.access.communications.assertRecipient(announcement, recipientKind, recipientId, subjectId)
        }
      }
      else {
        await this.baseService.access.communications.assertCreate()
      }
      const delivery = new MessageDelivery({
        id,
        schoolId,
        announcementId,
        eventKey,
        sourceKey: announcementId,
        subjectId,
        title,
        body,
        recipientKind,
        recipientId,
        status,
        providerMessageId,
        failureReason,
        sentAt,
        readAt,
        createdAt,
        updatedAt,
      })
      await this.baseService.entities.messageDeliveries.save(delivery)
      return delivery
    })
  }

  async materializeDeliveries({ announcementId, createdAt }: MaterializeDeliveriesInput): Promise<MessageDelivery[]> {
    return this.baseService.atomicExecution.execute(async () => {
      const announcement = await this.baseService.access.communications.materializationContext(announcementId)
      return this.materializeAnnouncement(announcement, createdAt)
    })
  }

  private async materializeAnnouncement(current: Announcement, createdAt?: Date): Promise<MessageDelivery[]> {
    await this.baseService.access.communications.assertSend(current)
    if (!current.isPublished)
      throw new BusinessRuleViolationError('MATERIALIZE_DELIVERIES_UNPUBLISHED', 'The announcement must be published before materializing deliveries')
    const recipients = await this.baseService.access.communications.recipients(current)
    const deliveries: MessageDelivery[] = []
    for (const recipient of recipients) {
      const { subjectId } = recipient
      const deliveryId = buildDeliveryId(current.schoolId, current.id, subjectId, recipient.recipientKind, recipient.recipientId)
      const existing = (await this.repositories.messageDeliveries.list({
        schoolId: current.schoolId,
        sourceKey: current.id,
        subjectId,
        recipientKind: recipient.recipientKind,
        recipientId: recipient.recipientId,
      }))[0]
      if (existing) {
        await this.baseService.access.communications.assertMaterializedDelivery(existing)
        deliveries.push(existing)
        continue
      }
      const delivery = new MessageDelivery({
        id: deliveryId,
        schoolId: current.schoolId,
        announcementId: current.id,
        sourceKey: current.id,
        subjectId,
        recipientKind: recipient.recipientKind,
        recipientId: recipient.recipientId,
        title: current.title,
        body: current.content,
        createdAt,
        updatedAt: createdAt,
      })
      const scope = await this.baseService.access.communications.assertMaterializedDelivery(delivery)
      await this.repositories.messageDeliveries.forAccess(scope).save(delivery)
      deliveries.push(delivery)
    }
    return deliveries
  }

  async applyDeliveryEvent({
    deliveryId,
    status,
    providerMessageId,
    failureReason,
    occurredAt,
  }: ApplyDeliveryEventInput): Promise<MessageDelivery | undefined> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.baseService.access.communications.deliveryEventContext(deliveryId)
      if (!existing) {
        return undefined
      }
      this.checkActorSchool(existing.schoolId)
      if (!canTransitionDeliveryStatus(existing.status, status)) {
        return existing
      }
      const at = occurredAt ?? new Date()
      const delivery = new MessageDelivery({
        id: existing.id,
        schoolId: existing.schoolId,
        announcementId: existing.announcementId,
        eventKey: existing.eventKey,
        sourceKey: existing.sourceKey,
        subjectId: existing.subjectId,
        title: existing.title,
        body: existing.body,
        recipientKind: existing.recipientKind,
        recipientId: existing.recipientId,
        status,
        providerMessageId: providerMessageId ?? existing.providerMessageId,
        failureReason: status === DeliveryStatus.Failed
          ? (failureReason ?? existing.failureReason ?? 'Delivery failed')
          : existing.failureReason,
        sentAt: status === DeliveryStatus.Sent || status === DeliveryStatus.Read
          ? (existing.sentAt ?? at)
          : existing.sentAt,
        readAt: status === DeliveryStatus.Read
          ? (existing.readAt ?? at)
          : existing.readAt,
        createdAt: existing.createdAt,
        updatedAt: at,
      })
      await this.baseService.entities.messageDeliveries.save(delivery)
      return delivery
    })
  }

  async markDeliveryRead({
    deliveryId,
    readAt,
  }: MarkDeliveryReadInput): Promise<MessageDelivery> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.repositories.messageDeliveries.findById(deliveryId)
      if (!existing) {
        denyResourceAccess()
      }
      this.checkActorSchool(existing.schoolId)
      const scope = await this.baseService.access.communications.assertMarkRead(existing)
      if (existing.status === DeliveryStatus.Read) {
        return existing
      }
      const at = readAt ?? new Date()
      const delivery = new MessageDelivery({
        id: existing.id,
        schoolId: existing.schoolId,
        announcementId: existing.announcementId,
        eventKey: existing.eventKey,
        sourceKey: existing.sourceKey,
        subjectId: existing.subjectId,
        title: existing.title,
        body: existing.body,
        recipientKind: existing.recipientKind,
        recipientId: existing.recipientId,
        status: DeliveryStatus.Read,
        providerMessageId: existing.providerMessageId,
        failureReason: existing.failureReason,
        sentAt: existing.sentAt ?? at,
        readAt: at,
        createdAt: existing.createdAt,
        updatedAt: at,
      })
      await this.repositories.messageDeliveries.forAccess(scope).save(delivery)
      return delivery
    })
  }

  async updateNotificationContact(
    input: UpdateNotificationContactInput,
  ): Promise<StaffMember> {
    return this.baseService.atomicExecution.execute(async () => {
      const actor = await this.baseService.access.communications.assertOwnAccount()

      const notificationEmail = normalizeNotificationContact(input.notificationEmail)
      const notificationPhone = normalizeNotificationContact(input.notificationPhone)

      if (actor.kind === 'staff') {
        const existing = await this.repositories.staffMembers.findById(actor.staffMemberId)
        if (!existing) {
          denyResourceAccess()
        }
        this.checkActorSchool(existing.schoolId)
        if (!existing.subjectId) {
          throw new BusinessRuleViolationError(
            'NOTIFICATION_CONTACT_SUBJECT_REQUIRED',
            'Link a login account before configuring notification contact details',
          )
        }
        const staffMember = new StaffMemberEntity({
          ...existing.data,
          id: existing.id,
          schoolId: existing.schoolId,
          firstName: existing.firstName,
          lastName: existing.lastName,
          email: existing.email,
          notificationEmail,
          notificationPhone,
          subjectId: existing.subjectId,
          accountKind: existing.accountKind,
          serviceId: existing.serviceId,
          createdBySubjectId: existing.createdBySubjectId,
          serviceElevated: existing.serviceElevated,
          isActive: existing.isActive,
          profileRole: existing.profileRole,
          createdAt: existing.createdAt,
        })
        const scope = await this.baseService.access.communications.assertContactUpdate('staffMembers', existing, staffMember)
        await this.repositories.staffMembers.forAccess(scope).save(staffMember)

        return staffMember
      }

      throw new BusinessRuleViolationError(
        'NOTIFICATION_CONTACT_UNSUPPORTED_ACTOR',
        'Only linked staff accounts can update notification contact details',
      )
    })
  }

  async registerPushDevice(input: RegisterPushDeviceInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      const actor = await this.baseService.access.communications.assertOwnAccount()

      const gateway = this.baseService.notificationGateway
      if (!gateway.registerPushDevice) {
        throw new BusinessRuleViolationError(
          'PUSH_DEVICE_GATEWAY_UNAVAILABLE',
          'Push device registration is not available',
        )
      }

      if (!isInteractiveActor(actor)) {
        throw new BusinessRuleViolationError(
          'PUSH_DEVICE_SUBJECT_REQUIRED',
          'Link a login account before registering a push device',
        )
      }

      if (input.appId !== actor.kind || !input.installationId.trim())
        throw new BusinessRuleViolationError('PUSH_DEVICE_PROFILE_MISMATCH', 'The app must match the selected profile')
      const profileId = actor.kind === 'staff' ? actor.staffMemberId : actor.kind === 'teacher' ? actor.teacherId : actor.kind === 'guardian' ? actor.guardianId : actor.studentId
      await gateway.registerPushDevice({
        appId: input.appId,
        installationId: input.installationId,
        profileKind: actor.kind,
        profileId,
        subjectId: actor.subjectId,
        schoolId: actor.schoolId,
        token: input.token.trim(),
        provider: input.provider,
      })
    })
  }

  async unregisterPushDevice(input: UnregisterPushDeviceInput): Promise<void> {
    return this.baseService.atomicExecution.execute(async () => {
      const actor = await this.baseService.access.communications.assertOwnAccount()

      const gateway = this.baseService.notificationGateway
      if (!gateway.unregisterPushDevice) {
        return
      }

      await gateway.unregisterPushDevice({
        appId: input.appId,
        installationId: input.installationId,
        schoolId: actor.schoolId,
        subjectId: actor.subjectId,
        provider: input.provider,
      })
    })
  }

  private async requireAnnouncement(announcementId: string): Promise<Announcement> {
    const announcement = await this.repositories.announcements.findById(announcementId)
    if (!announcement || announcement.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return announcement
  }

  private async authorize(resource: {
    schoolId: string
    announcementId?: string
  }): Promise<void> {
    this.checkActorSchool(resource.schoolId)
  }
}
