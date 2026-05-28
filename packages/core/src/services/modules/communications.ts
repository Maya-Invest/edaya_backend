import type { AnnouncementPriority } from '../../entities/messaging/announcement'
import type { AnnouncementTargetKind } from '../../entities/messaging/announcement-target'
import type {
  MessageDeliveryChannel,
  MessageDeliveryStatus,
} from '../../entities/messaging/message-delivery'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { Announcement, AnnouncementStatus } from '../../entities/messaging/announcement'
import { AnnouncementTarget, AnnouncementTargetKind as TargetKind } from '../../entities/messaging/announcement-target'
import { MessageDelivery, MessageDeliveryRecipientKind } from '../../entities/messaging/message-delivery'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { BusinessRuleViolationError } from '../shared/business-rule-error'

export class CommunicationsService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.classGroups = args.repositories.classGroups
    this.gradeLevels = args.repositories.gradeLevels
    this.staffMembers = args.repositories.staffMembers
    this.guardians = args.repositories.guardians
    this.students = args.repositories.students
    this.enrollments = args.repositories.enrollments
    this.guardianLinks = args.repositories.guardianLinks
    this.announcements = args.repositories.announcements
    this.targets = args.repositories.announcementTargets
    this.deliveries = args.repositories.messageDeliveries
    this.atomicExecution = args.atomicExecution
  }

  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly gradeLevels: SchoolRepositories['gradeLevels']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly guardians: SchoolRepositories['guardians']
  private readonly students: SchoolRepositories['students']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly guardianLinks: SchoolRepositories['guardianLinks']
  private readonly announcements: SchoolRepositories['announcements']
  private readonly targets: SchoolRepositories['announcementTargets']
  private readonly deliveries: SchoolRepositories['messageDeliveries']
  private readonly atomicExecution: AtomicExecutionPort
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

  async createAnnouncement({
    id,
    schoolId,
    title,
    content,
    priority,
    premiumNotification,
    createdAt,
    expiresAt,
  }: {
    id: string
    schoolId: string
    title: string
    content: string
    priority?: AnnouncementPriority
    premiumNotification?: boolean
    createdAt?: Date
    expiresAt?: Date
  }): Promise<Announcement> {
    await this.authorize({ schoolId })
    const announcement = new Announcement({
      id,
      schoolId,
      title,
      content,
      createdBy: resolveAuditActorId(this.actor),
      priority,
      premiumNotification,
      status: AnnouncementStatus.Draft,
      createdAt,
      expiresAt,
    })
    await this.announcements.save(announcement)
    return announcement
  }

  async addTarget({
    id,
    announcementId,
    targetKind,
    targetId,
    createdAt,
  }: {
    id: string
    announcementId: string
    targetKind: AnnouncementTargetKind
    targetId?: string
    createdAt?: Date
  }): Promise<AnnouncementTarget> {
    const announcement = await this.requireAnnouncement(announcementId)
    await this.authorize({ schoolId: announcement.schoolId, announcementId })
    const target = new AnnouncementTarget({ id, announcementId, targetKind, targetId, createdAt })
    await this.requireTargetInSchool(target, announcement.schoolId)
    await this.targets.save(target)
    return target
  }

  async publishAnnouncement({
    announcementId,
    publishedAt,
  }: {
    announcementId: string
    publishedAt?: Date
  }): Promise<Announcement> {
    const existing = await this.requireAnnouncement(announcementId)
    await this.authorize({ schoolId: existing.schoolId, announcementId })
    if ((await this.targets.list({ announcementId })).length === 0) {
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
    await this.announcements.save(announcement)
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
  }: {
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
  }): Promise<MessageDelivery> {
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
    await this.deliveries.save(delivery)
    return delivery
  }

  async materializeDeliveries({
    announcementId,
    channel,
    createdAt,
  }: {
    announcementId: string
    channel: MessageDeliveryChannel
    createdAt?: Date
  }): Promise<MessageDelivery[]> {
    const announcement = await this.requireAnnouncement(announcementId)
    await this.authorize({ schoolId: announcement.schoolId, announcementId })
    return this.atomicExecution.execute(async () => {
      const current = await this.requireAnnouncement(announcementId)
      if (!current.isPublished) {
        throw new BusinessRuleViolationError('MATERIALIZE_DELIVERIES_UNPUBLISHED', `Announcement ${announcementId} must be published before materializing deliveries`)
      }
      const recipients = await this.resolveRecipients(current)
      const deliveries: MessageDelivery[] = []
      for (const recipient of recipients) {
        const existing = (await this.deliveries.list({
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
        await this.deliveries.save(delivery)
        deliveries.push(delivery)
      }
      return deliveries
    })
  }

  private async requireAnnouncement(announcementId: string): Promise<Announcement> {
    const announcement = await this.announcements.findById(announcementId)
    if (!announcement) {
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
        await this.requireOwnedResource(this.classGroups.findById(target.targetId), schoolId)
        return
      case TargetKind.GradeLevel:
        await this.requireOwnedResource(this.gradeLevels.findById(target.targetId), schoolId)
        return
      case TargetKind.StaffMember:
        await this.requireOwnedResource(this.staffMembers.findById(target.targetId), schoolId)
        return
      case TargetKind.Guardian:
        await this.requireOwnedResource(this.guardians.findById(target.targetId), schoolId)
        return
      case TargetKind.Student:
        await this.requireOwnedResource(this.students.findById(target.targetId), schoolId)
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
        await this.requireOwnedResource(this.staffMembers.findById(recipientId), schoolId)
        return
      case MessageDeliveryRecipientKind.Guardian:
        await this.requireOwnedResource(this.guardians.findById(recipientId), schoolId)
        return
      case MessageDeliveryRecipientKind.Student:
        await this.requireOwnedResource(this.students.findById(recipientId), schoolId)
    }
  }

  private async requireRecipientMatchesTarget(
    announcementId: string,
    recipientKind: MessageDeliveryRecipientKind,
    recipientId: string,
  ): Promise<void> {
    const targets = await this.targets.list({ announcementId })
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
        const links = await this.guardianLinks.list({ guardianId: recipientId })
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
        this.staffMembers.list({ schoolId: announcement.schoolId }),
        this.guardians.list({ schoolId: announcement.schoolId }),
        this.students.list({ schoolId: announcement.schoolId }),
      ])
      staffMembers.forEach(staff => add(MessageDeliveryRecipientKind.Staff, staff.id))
      guardians.forEach(guardian => add(MessageDeliveryRecipientKind.Guardian, guardian.id))
      students.forEach(student => add(MessageDeliveryRecipientKind.Student, student.id))
    }
    const addEnrollmentRecipients = async (classGroupId: string) => {
      const enrollments = await this.enrollments.list({
        classGroupId,
        status: StudentClassEnrollmentStatus.Active,
      })
      for (const enrollment of enrollments) {
        const student = await this.students.findById(enrollment.studentId)
        if (!student || student.schoolId !== announcement.schoolId) {
          denyResourceAccess()
        }
        add(MessageDeliveryRecipientKind.Student, student.id)
        const links = await this.guardianLinks.list({ studentId: student.id })
        for (const link of links) {
          const guardian = await this.guardians.findById(link.guardianId)
          if (!guardian || guardian.schoolId !== announcement.schoolId) {
            denyResourceAccess()
          }
          add(MessageDeliveryRecipientKind.Guardian, guardian.id)
        }
      }
    }

    const targets = await this.targets.list({ announcementId: announcement.id })
    for (const target of targets) {
      await this.requireTargetInSchool(target, announcement.schoolId)
      switch (target.targetKind) {
        case TargetKind.School:
          await addSchoolRecipients()
          break
        case TargetKind.AllStaff:
          (await this.staffMembers.list({ schoolId: announcement.schoolId }))
            .forEach(staff => add(MessageDeliveryRecipientKind.Staff, staff.id))
          break
        case TargetKind.AllGuardians:
          (await this.guardians.list({ schoolId: announcement.schoolId }))
            .forEach(guardian => add(MessageDeliveryRecipientKind.Guardian, guardian.id))
          break
        case TargetKind.AllStudents:
          (await this.students.list({ schoolId: announcement.schoolId }))
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
          const classGroups = await this.classGroups.list({ gradeLevelId: target.targetId! })
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
    const enrollments = await this.enrollments.list({ studentId, status: StudentClassEnrollmentStatus.Active })
    for (const enrollment of enrollments) {
      const classGroup = await this.classGroups.findById(enrollment.classGroupId)
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
    await this.authorizationPolicy.requirePermission(this.actor, {
      action: 'communications.manage',
      resource,
    })
  }
}
