import type { BaseRepositoryInterface, CoreEntityMap, MessageDeliveryRecipientKind } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { AnnouncementTargetKind, BusinessRuleViolationError, Permission, resourceAccessScope } from '@edaya/core'
import { AccessFacts, denied } from './facts'

export const DELIVERY_WRITER_SYSTEM_IDS = ['notify-adapter', 'notification-delivery-webhook', 'reconcilePendingDeliveries', 'fixture-seed'] as const

/** Personal communications bind PERSONAL_COMMUNICATIONS_READ to the selected profile. */
export class CommunicationsAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  assertCreate() {
    return this.access.assertSchool(Permission.COMMUNICATION_DRAFT_MANAGE)
  }

  async assertSend(announcement: CoreEntityMap['announcements']) {
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    await facts.validateActor()
    if (announcement.schoolId !== this.access.actor.schoolId)
      return denied()
    const targets = await this.access.repositories.announcementTargets.list({ announcementId: announcement.id })
    if (!targets.length)
      throw new BusinessRuleViolationError('PUBLISH_WITHOUT_TARGETS', 'An announcement must have an audience before sending')
    for (const target of targets) {
      if (target.targetId) {
        const resources = { class_group: 'classGroups', grade_level: 'gradeLevels', staff_member: 'staffMembers', guardian: 'guardians', student: 'students' } as const
        if (target.targetKind in resources)
          await facts.one(resources[target.targetKind as keyof typeof resources], target.targetId)
      }
      if (target.targetKind === AnnouncementTargetKind.ClassGroup) {
        await this.access.assertResources(Permission.COMMUNICATION_SEND, 'classGroups', [target.targetId!])
      }
      else if (target.targetKind === AnnouncementTargetKind.GradeLevel) {
        await this.access.assertResources(Permission.COMMUNICATION_SEND, 'gradeLevels', [target.targetId!])
      }
      else {
        await this.access.assertSchool(Permission.COMMUNICATION_SEND_BROADCAST)
      }
    }
    return resourceAccessScope(announcement.schoolId, 'announcements', [{ target: { kind: 'records', ids: [announcement.id] } }])
  }

  async assertPublish(after: CoreEntityMap['announcements'], before?: CoreEntityMap['announcements']) {
    if (before) {
      const content = ({ status: _status, publishedAt: _publishedAt, ...data }: typeof before.data) => data
      if (JSON.stringify(content(before.data)) !== JSON.stringify(content(after.data)))
        return denied('Publishing may change only status and publication time')
    }
    return this.assertSend(after)
  }

  async materializationContext(announcementId: string) {
    await this.access.assertIntegrationCaller(['fixture-seed'])
    const announcement = await new AccessFacts(this.access.actor, this.access.repositories).one('announcements', announcementId)
    await this.assertSend(announcement)
    return announcement
  }

  async deliveryEventContext(deliveryId: string) {
    await this.access.assertIntegrationCaller(DELIVERY_WRITER_SYSTEM_IDS)
    const scope = await this.access.scope(Permission.COMMUNICATION_DRAFT_MANAGE, 'messageDeliveries', 'write', 'update')
    const delivery = await this.access.repositories.messageDeliveries.findById(deliveryId)
    if (delivery)
      await this.access.repositories.messageDeliveries.forAccess(scope).assertAccess(delivery)
    return delivery
  }

  async assertMaterializedDelivery(delivery: CoreEntityMap['messageDeliveries']) {
    if (!delivery.announcementId)
      return denied('An announcement delivery must identify its announcement')
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const announcement = await facts.one('announcements', delivery.announcementId)
    await this.assertSend(announcement)
    if (!announcement.isPublished)
      throw new BusinessRuleViolationError('MATERIALIZE_DELIVERIES_UNPUBLISHED', 'The announcement must be published')
    if (delivery.schoolId !== announcement.schoolId || !delivery.recipientKind || !delivery.recipientId)
      return denied()
    await this.assertRecipient(announcement, delivery.recipientKind, delivery.recipientId, delivery.subjectId)
    return resourceAccessScope(announcement.schoolId, 'messageDeliveries', [{ target: { kind: 'records', ids: [delivery.id] } }])
  }

  async assertRecipient(announcement: CoreEntityMap['announcements'], kind: MessageDeliveryRecipientKind, id: string, subjectId: string) {
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const resource = { staff: 'staffMembers', teacher: 'teachers', guardian: 'guardians', student: 'students' } as const
    const recipient = await facts.one(resource[kind], id)
    if (!recipient.subjectId || recipient.subjectId !== subjectId)
      return denied('Delivery recipient must identify the linked login account')
    const scope = resourceAccessScope(this.access.actor.schoolId, 'announcements', [{ target: await facts.communicationAudience(kind, id) }])
    if (!await this.access.repositories.announcements.forAccess(scope).findById(announcement.id))
      throw new BusinessRuleViolationError('RECIPIENT_NOT_ELIGIBLE', 'The recipient is outside the published announcement audience')
  }

  async recipients(announcement: CoreEntityMap['announcements']) {
    await this.assertSend(announcement)
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const result: Array<{ recipientKind: MessageDeliveryRecipientKind, recipientId: string, subjectId: string }> = []
    for (const [kind, resource] of Object.entries({ staff: 'staffMembers', teacher: 'teachers', guardian: 'guardians', student: 'students' } as const)) {
      const profiles = await facts.repository(resource).list()
      for (const profile of profiles) {
        if (!profile.subjectId || ('isActive' in profile && !profile.isActive) || ('hasAccess' in profile && !profile.hasAccess) || ('status' in profile && profile.status !== 'active'))
          continue
        const recipientKind = kind as MessageDeliveryRecipientKind
        const scope = resourceAccessScope(this.access.actor.schoolId, 'announcements', [{ target: await facts.communicationAudience(recipientKind, profile.id) }])
        if (await this.access.repositories.announcements.forAccess(scope).findById(announcement.id))
          result.push({ recipientKind, recipientId: profile.id, subjectId: profile.subjectId })
      }
    }
    return result.sort((left, right) => left.recipientKind.localeCompare(right.recipientKind) || left.recipientId.localeCompare(right.recipientId))
  }

  async assertOwnAccount() {
    const actor = this.access.actor
    if (actor.kind === 'system' || actor.kind === 's2s' || (actor.kind === 'staff' && actor.accountKind !== 'human'))
      return denied('Personal communications require an interactive human profile')
    await new AccessFacts(actor, this.access.repositories).validateActor()
    await this.access.scope(Permission.PERSONAL_COMMUNICATIONS_READ, 'messageDeliveries')
    return actor
  }

  async assertMarkRead(delivery: CoreEntityMap['messageDeliveries']) {
    const actor = await this.assertOwnAccount()
    if (delivery.recipientKind !== actor.kind || delivery.recipientId !== actor.actorId || delivery.subjectId !== actor.subjectId)
      return denied('A delivery belongs to its selected recipient profile')
    const scope = await this.access.scope(Permission.PERSONAL_COMMUNICATIONS_READ, 'messageDeliveries')
    await this.access.repositories.messageDeliveries.forAccess(scope).assertAccess(delivery)
    return scope
  }

  async assertContactUpdate<K extends 'staffMembers' | 'guardians'>(resource: K, before: CoreEntityMap[K], after: CoreEntityMap[K]) {
    const actor = await this.assertOwnAccount()
    if ((resource === 'staffMembers' ? actor.kind !== 'staff' : actor.kind !== 'guardian')
      || before.id !== actor.actorId || after.id !== before.id || before.subjectId !== actor.subjectId || after.subjectId !== before.subjectId) {
      return denied('Notification contacts belong to the selected profile')
    }
    const unchanged = (profile: CoreEntityMap[K]) => {
      const { notificationEmail: _email, notificationPhone: _phone, ...data } = profile.data
      return data
    }
    if (JSON.stringify(unchanged(before)) !== JSON.stringify(unchanged(after)))
      return denied('Personal contact updates may change only notification channels')
    const scope = await this.access.scope(Permission.PERSONAL_COMMUNICATIONS_READ, resource)
    const repository = this.access.repositories[resource].forAccess(scope) as unknown as BaseRepositoryInterface<CoreEntityMap[K]>
    await repository.assertAccess(before)
    await repository.assertAccess(after)
    return scope
  }
}
