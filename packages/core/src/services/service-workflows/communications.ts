import type { AnnouncementTarget } from '../../entities/messaging/announcement-target'
import type { MessageDeliveryChannel, MessageDeliveryStatus } from '../../entities/messaging/message-delivery'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, Permission } from '../../authorization'
import { Announcement, AnnouncementStatus } from '../../entities/messaging/announcement'
import { AnnouncementTargetKind as TargetKind } from '../../entities/messaging/announcement-target'
import { MessageDelivery, MessageDeliveryRecipientKind } from '../../entities/messaging/message-delivery'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { permissionAction } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface PublishAnnouncementInput {
  announcementId: string
  publishedAt?: Date
}

export interface RecordDeliveryInput {
  id: string
  announcementId: string
  recipientKind: MessageDeliveryRecipientKind
  recipientId: string
  channel: MessageDeliveryChannel
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
  channel: MessageDeliveryChannel
  createdAt?: Date
}

export class CommunicationsServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async publishAnnouncement({
    announcementId,
    publishedAt,
  }: PublishAnnouncementInput): Promise<Announcement> {
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
      premiumNotification: existing.premiumNotification,
      status: AnnouncementStatus.Published,
      createdAt: existing.createdAt,
      publishedAt: publishedAt ?? new Date(),
      expiresAt: existing.expiresAt,
    })
    await this.baseService.announcements.save(announcement, { moduleChecked: true })
    return announcement
  }

  async recordDelivery({
    id,
    announcementId,
    recipientKind,
    recipientId,
    channel,
    status,
    providerMessageId,
    failureReason,
    sentAt,
    readAt,
    createdAt,
    updatedAt,
  }: RecordDeliveryInput): Promise<MessageDelivery> {
    const announcement = await this.requireAnnouncement(announcementId)
    await this.authorize({ schoolId: announcement.schoolId, announcementId })
    await this.requireRecipientInSchool(recipientKind, recipientId, announcement.schoolId)
    if (!announcement.isPublished) {
      throw new BusinessRuleViolationError('RECORD_DELIVERY_UNPUBLISHED', `Announcement ${announcementId} must be published before recording delivery`)
    }
    await this.requireRecipientMatchesTarget(announcementId, recipientKind, recipientId)
    const delivery = new MessageDelivery({
      id,
      announcementId,
      recipientKind,
      recipientId,
      channel,
      status,
      providerMessageId,
      failureReason,
      sentAt,
      readAt,
      createdAt,
      updatedAt,
    })
    await this.baseService.messageDeliveries.save(delivery, { moduleChecked: true })
    return delivery
  }

  async materializeDeliveries({
    announcementId,
    channel,
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
        const existing = (await this.baseService.repositories.messageDeliveries.list({
          announcementId,
          recipientKind: recipient.recipientKind,
          recipientId: recipient.recipientId,
          channel,
        }))[0]
        if (existing) {
          deliveries.push(existing)
          continue
        }
        const delivery = new MessageDelivery({
          id: `generated:${announcementId}:${channel}:${recipient.recipientKind}:${recipient.recipientId}`,
          announcementId,
          recipientKind: recipient.recipientKind,
          recipientId: recipient.recipientId,
          channel,
          createdAt,
          updatedAt: createdAt,
        })
        await this.baseService.messageDeliveries.save(delivery, { moduleChecked: true })
        deliveries.push(delivery)
      }
      return deliveries
    })
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
    await permissionAction(this.baseService.authorizationPolicy, Permission.COMMUNICATION_CREATE)(this.baseService.actor)
  }
}
