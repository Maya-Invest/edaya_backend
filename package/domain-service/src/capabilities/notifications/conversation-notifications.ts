import type { NotificationRecipient } from '@edaya/core'
import type { SchoolApplication } from '../../services/school-application'
import { ActorAssuranceLevel, AuthorizationError, createAccessPolicies, createGuardianActorMetadata, createStaffActorMetadata, createSystemActorMetadata, createTeacherActorMetadata } from '@edaya/authorization'
import { CONVERSATION_NOTIFY_KIND, MessageDeliveryRecipientKind } from '@edaya/core'
import { runDurableWorkBatch } from '../scheduling-jobs/durable-work'
import { deliverNotification } from './delivery/deliver-notification'

/** Persisted message references are resolved only by this admitted durable handler. */
export async function dispatchConversationNotifications(application: Pick<SchoolApplication, 'forActor' | 'durableWork'>) {
  return runDurableWorkBatch(application.durableWork, {
    [CONVERSATION_NOTIFY_KIND]: { version: 1, run: async (work) => {
      const [conversationId, sequenceText] = work.resourceId.split(':')
      if (!conversationId || !sequenceText)
        throw new Error('Invalid conversation notification reference')
      const sequence = Number(sequenceText)
      const base = application.forActor(createSystemActorMetadata({ schoolId: work.schoolId, systemId: 'notify-adapter', requestId: work.id, reason: CONVERSATION_NOTIFY_KIND })).baseService
      const internal = { schoolId: work.schoolId, ids: [conversationId], profileKind: 'staff' as const, profileId: 'notify-adapter' }
      const conversation = await base.repositories.conversations.find(internal, conversationId)
      const message = (await base.repositories.conversations.messages(internal, conversationId, sequence + 1, 1))[0]
      if (!conversation || !message || message.sequence !== sequence)
        return
      const candidates: NotificationRecipient[] = []
      if (message.authorKind !== 'guardian')
        candidates.push({ kind: MessageDeliveryRecipientKind.Guardian, id: conversation.guardianId })
      else if (conversation.destination === 'teacher' && conversation.teacherId)
        candidates.push({ kind: MessageDeliveryRecipientKind.Teacher, id: conversation.teacherId })
      else candidates.push(...(await application.forActor(createSystemActorMetadata({ schoolId: work.schoolId, systemId: 'notify-adapter', requestId: work.id, reason: CONVERSATION_NOTIFY_KIND })).conversationsWorkflow.schoolRecipients()).map(staff => ({ kind: MessageDeliveryRecipientKind.Staff, id: staff.id })))
      const recipients: NotificationRecipient[] = []
      for (const recipient of candidates) {
        const repo = recipient.kind === 'guardian' ? base.repositories.guardians : recipient.kind === 'teacher' ? base.repositories.teachers : base.repositories.staffMembers
        const profile = await repo.forSchool!(work.schoolId).findById(recipient.id)
        if (!profile?.subjectId)
          continue
        const context = { schoolId: work.schoolId, subjectId: profile.subjectId, authenticatedAt: new Date(), requestId: work.id, assuranceLevel: ActorAssuranceLevel.Verified }
        const actor = recipient.kind === 'guardian' ? createGuardianActorMetadata({ ...context, guardianId: recipient.id }) : recipient.kind === 'teacher' ? createTeacherActorMetadata({ ...context, teacherId: recipient.id }) : createStaffActorMetadata({ ...context, staffMemberId: recipient.id })
        try {
          await createAccessPolicies({ actor, repositories: base.repositories }).conversations.assertRead(conversation)
          recipients.push({ ...recipient, subjectId: profile.subjectId })
        }
        catch (error) {
          if (!(error instanceof AuthorizationError))
            throw error
        }
      }
      await deliverNotification({ repositories: base.repositories, notificationGateway: base.notificationGateway }, {
        schoolId: work.schoolId,
        kind: 'event',
        eventKey: CONVERSATION_NOTIFY_KIND,
        idempotencyKeyPrefix: `${CONVERSATION_NOTIFY_KIND}:${conversationId}:${sequence}`,
        title: 'EDAYA',
        body: 'Nouveau message / New message',
        enablePush: true,
        enableEmail: false,
        enableSms: false,
        recipients,
        metadata: { route: `/inbox/conversation/${conversationId}`, conversationId, sequence: String(sequence), schoolId: work.schoolId, ...(conversation.studentId ? { studentId: conversation.studentId } : {}) },
      })
    } },
  })
}
