import type {
  AnnouncementInput,
  AnnouncementTarget,
  AnnouncementTargetInput,
  Guardian,
  MessageDeliveryStatus,
  StaffMember,
} from '../../domain'
import type { BaseSchoolService } from '../base-school-service'
import { permissionAction } from '../../application/entities/entity-config'
import { denyResourceAccess, isInteractiveActor, Permission } from '../../capabilities/authorization'
import {
  ANNOUNCEMENT_PUBLISHED_EVENT_KEY,
  buildGuardianRecipientProfile,
  buildNotificationDeliveryId,
  buildStaffRecipientProfile,
  ensureNotificationRecipientForActor,
  runWorkflowNotifications,
  scheduleNotificationRecipientUpsert,
} from '../../capabilities/notifications'
import {
  Announcement,
  AnnouncementStatus,
  AnnouncementTarget as AnnouncementTargetEntity,
  MessageDeliveryStatus as DeliveryStatus,
  Guardian as GuardianEntity,
  MessageDelivery,
  MessageDeliveryRecipientKind,
  StaffMember as StaffMemberEntity,
  StudentClassEnrollmentStatus,
  AnnouncementTargetKind as TargetKind,
} from '../../domain'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
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
  token: string
  provider: 'fcm' | 'apns'
}

export interface UnregisterPushDeviceInput {
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

function buildDeliveryId(announcementId: string, subjectId: string): string {
  return buildNotificationDeliveryId(announcementId, subjectId)
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
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async createAnnouncement(input: CreateAnnouncementInput): Promise<Announcement> {
    const announcement = new Announcement(input)
    await this.baseService.entities.announcements.save(announcement)
    return announcement
  }

  async addTarget(input: AddAnnouncementTargetInput): Promise<AnnouncementTarget> {
    const target = new AnnouncementTargetEntity(input)
    await this.baseService.entities.announcementTargets.save(target)
    return target
  }

  async publishAnnouncement(
    {
      announcementId,
      publishedAt,
    }: PublishAnnouncementInput,
    options?: PublishAnnouncementOptions,
  ): Promise<Announcement> {
    const existing = await this.requireAnnouncement(announcementId)
    await this.authorize({ schoolId: existing.schoolId, announcementId })
    if ((await this.baseService.repositories.announcementTargets.list({ announcementId })).length === 0) {
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
    await this.baseService.entities.announcements.save(announcement, { moduleChecked: true })
    if (!options?.deferNotifications) {
      await this.dispatchPublishedAnnouncementNotifications(announcement)
    }
    return announcement
  }

  async dispatchPublishedAnnouncementNotifications(
    announcementOrId: Announcement | string,
  ): Promise<void> {
    const announcement = typeof announcementOrId === 'string'
      ? await this.requireAnnouncement(announcementOrId)
      : announcementOrId
    if (!announcement.isPublished) {
      throw new BusinessRuleViolationError(
        'DISPATCH_UNPUBLISHED_ANNOUNCEMENT',
        `Announcement ${announcement.id} must be published before dispatching notifications`,
      )
    }
    const deliveries = await this.materializeDeliveries({
      announcementId: announcement.id,
      createdAt: announcement.publishedAt ?? new Date(),
    })
    await runWorkflowNotifications(this.baseService, ANNOUNCEMENT_PUBLISHED_EVENT_KEY, {
      announcement,
      deliveries,
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
    this.checkActorSchool(schoolId)
    if (announcementId) {
      const announcement = await this.requireAnnouncement(announcementId)
      await this.authorize({ schoolId: announcement.schoolId, announcementId })
      if (recipientKind && recipientId) {
        await this.requireRecipientInSchool(recipientKind, recipientId, announcement.schoolId)
        if (!announcement.isPublished) {
          throw new BusinessRuleViolationError('RECORD_DELIVERY_UNPUBLISHED', `Announcement ${announcementId} must be published before recording delivery`)
        }
        await this.requireRecipientMatchesTarget(announcementId, recipientKind, recipientId)
      }
    }
    else {
      await permissionAction(Permission.COMMUNICATION_CREATE)(this.baseService.actor)
    }
    const delivery = new MessageDelivery({
      id,
      schoolId,
      announcementId,
      eventKey,
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
    await this.baseService.entities.messageDeliveries.save(delivery, { moduleChecked: true })
    return delivery
  }

  async materializeDeliveries({
    announcementId,
    createdAt,
  }: MaterializeDeliveriesInput): Promise<MessageDelivery[]> {
    const announcement = await this.requireAnnouncement(announcementId)
    await this.authorize({ schoolId: announcement.schoolId, announcementId })
    return this.baseService.atomicExecution.execute(async () => {
      const current = await this.requireAnnouncement(announcementId)
      if (!current.isPublished) {
        throw new BusinessRuleViolationError('MATERIALIZE_DELIVERIES_UNPUBLISHED', `Announcement ${announcementId} must be published before materializing deliveries`)
      }
      const recipients = await this.resolveRecipients(current)
      const deliveries: MessageDelivery[] = []
      for (const recipient of recipients) {
        const subjectId = await this.resolveSubjectId(recipient.recipientKind, recipient.recipientId)
        if (!subjectId) {
          continue
        }
        const deliveryId = buildDeliveryId(announcementId, subjectId)
        const existing = (await this.baseService.repositories.messageDeliveries.list({
          announcementId,
          subjectId,
        }))[0]
        if (existing) {
          deliveries.push(existing)
          continue
        }
        const delivery = new MessageDelivery({
          id: deliveryId,
          schoolId: current.schoolId,
          announcementId,
          subjectId,
          recipientKind: recipient.recipientKind,
          recipientId: recipient.recipientId,
          title: current.title,
          body: current.content,
          createdAt,
          updatedAt: createdAt,
        })
        await this.baseService.entities.messageDeliveries.save(delivery, { moduleChecked: true })
        deliveries.push(delivery)
      }
      return deliveries
    })
  }

  async applyDeliveryEvent({
    deliveryId,
    status,
    providerMessageId,
    failureReason,
    occurredAt,
  }: ApplyDeliveryEventInput): Promise<MessageDelivery | undefined> {
    const existing = await this.baseService.repositories.messageDeliveries.findById(deliveryId)
    if (!existing) {
      return undefined
    }
    this.checkActorSchool(existing.schoolId)
    if (this.baseService.actor.kind !== 'system') {
      await permissionAction(Permission.COMMUNICATION_CREATE)(this.baseService.actor)
    }
    if (!canTransitionDeliveryStatus(existing.status, status)) {
      return existing
    }
    const at = occurredAt ?? new Date()
    const delivery = new MessageDelivery({
      id: existing.id,
      schoolId: existing.schoolId,
      announcementId: existing.announcementId,
      eventKey: existing.eventKey,
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
    await this.baseService.entities.messageDeliveries.save(delivery, { moduleChecked: true })
    return delivery
  }

  async markDeliveryRead({
    deliveryId,
    readAt,
  }: MarkDeliveryReadInput): Promise<MessageDelivery> {
    const existing = await this.baseService.repositories.messageDeliveries.findById(deliveryId)
    if (!existing) {
      denyResourceAccess()
    }
    this.checkActorSchool(existing.schoolId)
    const actor = this.baseService.actor
    if (actor.kind === 'system' || existing.subjectId !== actor.subjectId) {
      denyResourceAccess()
    }
    await permissionAction(Permission.QUERY_COMMUNICATIONS_READ)(this.baseService.actor)
    if (existing.status === DeliveryStatus.Read) {
      return existing
    }
    const at = readAt ?? new Date()
    const delivery = new MessageDelivery({
      id: existing.id,
      schoolId: existing.schoolId,
      announcementId: existing.announcementId,
      eventKey: existing.eventKey,
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
    await this.baseService.entities.messageDeliveries.save(delivery, { moduleChecked: true })
    return delivery
  }

  async updateNotificationContact(
    input: UpdateNotificationContactInput,
  ): Promise<StaffMember | Guardian> {
    const actor = this.baseService.actor
    await permissionAction(Permission.QUERY_COMMUNICATIONS_READ)(actor)

    const notificationEmail = normalizeNotificationContact(input.notificationEmail)
    const notificationPhone = normalizeNotificationContact(input.notificationPhone)

    if (actor.kind === 'staff') {
      const existing = await this.baseService.repositories.staffMembers.findById(actor.staffMemberId)
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
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.staffMembers.save(staffMember, { moduleChecked: true })
      scheduleNotificationRecipientUpsert(this.baseService, buildStaffRecipientProfile(staffMember))
      return staffMember
    }

    if (actor.kind === 'guardian') {
      const existing = await this.baseService.repositories.guardians.findById(actor.guardianId)
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
      const guardian = new GuardianEntity({
        id: existing.id,
        schoolId: existing.schoolId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        contactMethods: [...existing.contactMethods],
        notificationEmail,
        notificationPhone,
        subjectId: existing.subjectId,
        hasAccess: existing.hasAccess,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.guardians.save(guardian, { moduleChecked: true })
      const links = await this.baseService.repositories.guardianLinks.list({ guardianId: guardian.id })
      scheduleNotificationRecipientUpsert(
        this.baseService,
        buildGuardianRecipientProfile(guardian, links),
      )
      return guardian
    }

    throw new BusinessRuleViolationError(
      'NOTIFICATION_CONTACT_UNSUPPORTED_ACTOR',
      'Only linked staff and guardian accounts can update notification contact details',
    )
  }

  async registerPushDevice(input: RegisterPushDeviceInput): Promise<void> {
    const actor = this.baseService.actor
    await permissionAction(Permission.QUERY_COMMUNICATIONS_READ)(actor)

    if (actor.kind === 'system') {
      throw new BusinessRuleViolationError(
        'PUSH_DEVICE_SUBJECT_REQUIRED',
        'Link a login account before registering a push device',
      )
    }

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

    await ensureNotificationRecipientForActor(this.baseService, actor)

    await gateway.registerPushDevice({
      subjectId: actor.subjectId,
      schoolId: actor.schoolId,
      token: input.token.trim(),
      provider: input.provider,
    })
  }

  async unregisterPushDevice(input: UnregisterPushDeviceInput): Promise<void> {
    const actor = this.baseService.actor
    await permissionAction(Permission.QUERY_COMMUNICATIONS_READ)(actor)

    if (actor.kind === 'system') {
      throw new BusinessRuleViolationError(
        'PUSH_DEVICE_SUBJECT_REQUIRED',
        'Link a login account before unregistering a push device',
      )
    }

    const gateway = this.baseService.notificationGateway
    if (!gateway.unregisterPushDevice) {
      return
    }

    await gateway.unregisterPushDevice({
      subjectId: actor.subjectId,
      provider: input.provider,
    })
  }

  private async resolveSubjectId(
    recipientKind: MessageDeliveryRecipientKind,
    recipientId: string,
  ): Promise<string | undefined> {
    switch (recipientKind) {
      case MessageDeliveryRecipientKind.Staff: {
        const staff = await this.baseService.repositories.staffMembers.findById(recipientId)
        return staff?.subjectId
      }
      case MessageDeliveryRecipientKind.Guardian: {
        const guardian = await this.baseService.repositories.guardians.findById(recipientId)
        return guardian?.subjectId
      }
      case MessageDeliveryRecipientKind.Student: {
        const student = await this.baseService.repositories.students.findById(recipientId)
        return student?.subjectId
      }
    }
  }

  private async requireAnnouncement(announcementId: string): Promise<Announcement> {
    const announcement = await this.baseService.repositories.announcements.findById(announcementId)
    if (!announcement || announcement.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return announcement
  }

  private async requireTargetInSchool(
    target: AnnouncementTarget,
    schoolId: string,
  ): Promise<void> {
    if (!target.targetId) {
      return
    }
    switch (target.targetKind) {
      case TargetKind.ClassGroup:
        await this.requireOwnedResource(this.baseService.repositories.classGroups.findById(target.targetId), schoolId)
        return
      case TargetKind.GradeLevel:
        await this.requireOwnedResource(this.baseService.repositories.gradeLevels.findById(target.targetId), schoolId)
        return
      case TargetKind.StaffMember:
        await this.requireOwnedResource(this.baseService.repositories.staffMembers.findById(target.targetId), schoolId)
        return
      case TargetKind.Guardian:
        await this.requireOwnedResource(this.baseService.repositories.guardians.findById(target.targetId), schoolId)
        return
      case TargetKind.Student:
        await this.requireOwnedResource(this.baseService.repositories.students.findById(target.targetId), schoolId)
        break
      case TargetKind.School:
      case TargetKind.AllStaff:
      case TargetKind.AllGuardians:
      case TargetKind.AllStudents:
        break
    }
  }

  private async requireRecipientInSchool(
    recipientKind: MessageDeliveryRecipientKind,
    recipientId: string,
    schoolId: string,
  ): Promise<void> {
    switch (recipientKind) {
      case MessageDeliveryRecipientKind.Staff:
        await this.requireOwnedResource(this.baseService.repositories.staffMembers.findById(recipientId), schoolId)
        return
      case MessageDeliveryRecipientKind.Guardian:
        await this.requireOwnedResource(this.baseService.repositories.guardians.findById(recipientId), schoolId)
        return
      case MessageDeliveryRecipientKind.Student:
        await this.requireOwnedResource(this.baseService.repositories.students.findById(recipientId), schoolId)
    }
  }

  private async requireRecipientMatchesTarget(
    announcementId: string,
    recipientKind: MessageDeliveryRecipientKind,
    recipientId: string,
  ): Promise<void> {
    const targets = await this.baseService.repositories.announcementTargets.list({ announcementId })
    for (const target of targets) {
      if (await this.targetIncludesRecipient(target, recipientKind, recipientId)) {
        return
      }
    }
    throw new BusinessRuleViolationError('RECIPIENT_NOT_ELIGIBLE', `Recipient ${recipientId} is not eligible for announcement ${announcementId}`)
  }

  private async targetIncludesRecipient(
    target: AnnouncementTarget,
    recipientKind: MessageDeliveryRecipientKind,
    recipientId: string,
  ): Promise<boolean> {
    if (target.targetKind === TargetKind.School) {
      return true
    }
    switch (recipientKind) {
      case MessageDeliveryRecipientKind.Staff:
        return target.targetKind === TargetKind.AllStaff
          || (target.targetKind === TargetKind.StaffMember && target.targetId === recipientId)
      case MessageDeliveryRecipientKind.Student:
        if (
          target.targetKind === TargetKind.AllStudents
          || (target.targetKind === TargetKind.Student && target.targetId === recipientId)
        ) {
          return true
        }
        return this.studentHasActiveTargetEnrollment(recipientId, target)
      case MessageDeliveryRecipientKind.Guardian: {
        if (
          target.targetKind === TargetKind.AllGuardians
          || (target.targetKind === TargetKind.Guardian && target.targetId === recipientId)
        ) {
          return true
        }
        const links = await this.baseService.repositories.guardianLinks.list({ guardianId: recipientId })
        for (const link of links) {
          if (await this.studentHasActiveTargetEnrollment(link.studentId, target)) {
            return true
          }
        }
        return false
      }
    }
  }

  private async resolveRecipients(
    announcement: Announcement,
  ): Promise<Array<{ recipientKind: MessageDeliveryRecipientKind, recipientId: string }>> {
    const recipients = new Map<string, { recipientKind: MessageDeliveryRecipientKind, recipientId: string }>()
    const add = (recipientKind: MessageDeliveryRecipientKind, recipientId: string) => {
      recipients.set(`${recipientKind}:${recipientId}`, { recipientKind, recipientId })
    }
    const addSchoolRecipients = async () => {
      const [staffMembers, guardians, students] = await Promise.all([
        this.baseService.repositories.staffMembers.list({ schoolId: announcement.schoolId }),
        this.baseService.repositories.guardians.list({ schoolId: announcement.schoolId }),
        this.baseService.repositories.students.list({ schoolId: announcement.schoolId }),
      ])
      staffMembers.forEach(staff => add(MessageDeliveryRecipientKind.Staff, staff.id))
      guardians.forEach(guardian => add(MessageDeliveryRecipientKind.Guardian, guardian.id))
      students.forEach(student => add(MessageDeliveryRecipientKind.Student, student.id))
    }
    const addEnrollmentRecipients = async (classGroupId: string) => {
      const enrollments = await this.baseService.repositories.enrollments.list({
        classGroupId,
        status: StudentClassEnrollmentStatus.Active,
      })
      for (const enrollment of enrollments) {
        const student = await this.baseService.repositories.students.findById(enrollment.studentId)
        if (!student || student.schoolId !== announcement.schoolId) {
          denyResourceAccess()
        }
        add(MessageDeliveryRecipientKind.Student, student.id)
        const links = await this.baseService.repositories.guardianLinks.list({ studentId: student.id })
        for (const link of links) {
          const guardian = await this.baseService.repositories.guardians.findById(link.guardianId)
          if (!guardian || guardian.schoolId !== announcement.schoolId) {
            denyResourceAccess()
          }
          add(MessageDeliveryRecipientKind.Guardian, guardian.id)
        }
      }
    }

    const targets = await this.baseService.repositories.announcementTargets.list({ announcementId: announcement.id })
    for (const target of targets) {
      await this.requireTargetInSchool(target, announcement.schoolId)
      switch (target.targetKind) {
        case TargetKind.School:
          await addSchoolRecipients()
          break
        case TargetKind.AllStaff:
          (await this.baseService.repositories.staffMembers.list({ schoolId: announcement.schoolId }))
            .forEach(staff => add(MessageDeliveryRecipientKind.Staff, staff.id))
          break
        case TargetKind.AllGuardians:
          (await this.baseService.repositories.guardians.list({ schoolId: announcement.schoolId }))
            .forEach(guardian => add(MessageDeliveryRecipientKind.Guardian, guardian.id))
          break
        case TargetKind.AllStudents:
          (await this.baseService.repositories.students.list({ schoolId: announcement.schoolId }))
            .forEach(student => add(MessageDeliveryRecipientKind.Student, student.id))
          break
        case TargetKind.StaffMember:
          add(MessageDeliveryRecipientKind.Staff, target.targetId!)
          break
        case TargetKind.Guardian:
          add(MessageDeliveryRecipientKind.Guardian, target.targetId!)
          break
        case TargetKind.Student:
          add(MessageDeliveryRecipientKind.Student, target.targetId!)
          break
        case TargetKind.ClassGroup:
          await addEnrollmentRecipients(target.targetId!)
          break
        case TargetKind.GradeLevel: {
          const classGroups = await this.baseService.repositories.classGroups.list({ gradeLevelId: target.targetId! })
          for (const classGroup of classGroups) {
            if (classGroup.schoolId !== announcement.schoolId) {
              continue
            }
            await addEnrollmentRecipients(classGroup.id)
          }
          break
        }
      }
    }
    return [...recipients.values()].sort((left, right) =>
      left.recipientKind.localeCompare(right.recipientKind)
      || left.recipientId.localeCompare(right.recipientId))
  }

  private async studentHasActiveTargetEnrollment(
    studentId: string,
    target: AnnouncementTarget,
  ): Promise<boolean> {
    if (target.targetKind !== TargetKind.ClassGroup && target.targetKind !== TargetKind.GradeLevel) {
      return false
    }
    const enrollments = await this.baseService.repositories.enrollments.list({
      studentId,
      status: StudentClassEnrollmentStatus.Active,
    })
    for (const enrollment of enrollments) {
      const classGroup = await this.baseService.repositories.classGroups.findById(enrollment.classGroupId)
      if (
        classGroup
        && (
          (target.targetKind === TargetKind.ClassGroup && classGroup.id === target.targetId)
          || (target.targetKind === TargetKind.GradeLevel && classGroup.gradeLevelId === target.targetId)
        )
      ) {
        return true
      }
    }
    return false
  }

  private async requireOwnedResource(
    resourcePromise: Promise<{ schoolId: string } | undefined>,
    schoolId: string,
  ): Promise<void> {
    const resource = await resourcePromise
    if (!resource || resource.schoolId !== schoolId) {
      denyResourceAccess()
    }
  }

  private async authorize(resource: {
    schoolId: string
    announcementId?: string
  }): Promise<void> {
    this.checkActorSchool(resource.schoolId)
    await permissionAction(Permission.COMMUNICATION_CREATE)(this.baseService.actor)
  }
}
