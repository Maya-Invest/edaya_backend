import type { FamilyFeedbackCampaign, FamilyFeedbackSlot } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import {
  MessageDeliveryRecipientKind,
  Permission,
} from '@edaya/core'
import { cancelNotificationDeliveries } from '../notifications/delivery/deliver-notification'
import { resolveGuardiansForStudents } from '../notifications/delivery/recipient-resolvers'
import { enqueueTemplatedNotification } from '../notifications/templates/enqueue-templated-notification'
import { formatPersonName } from '../notifications/templates/format-notification-variables'

export function familyFeedbackOpenedSourceKey(campaignId: string, studentId: string): string {
  return `family_feedback.opened:${campaignId}:${studentId}`
}

export function familyFeedbackReminderSourceKey(campaignId: string, studentId: string, kind: 'mid' | 'final'): string {
  return `family_feedback.reminder:${campaignId}:${studentId}:${kind}`
}

export function familyFeedbackPublishedSourceKey(campaignId: string): string {
  return `family_feedback.published:${campaignId}`
}

export function familyFeedbackPurgeSourceKey(campaignId: string): string {
  return `family_feedback.purge_reminder:${campaignId}`
}

export async function cancelFamilyFeedbackSlotNotifications(
  base: BaseSchoolService,
  campaignId: string,
  studentId: string,
): Promise<void> {
  const deps = { notificationGateway: base.notificationGateway, repositories: base.repositories }
  await cancelNotificationDeliveries(deps, base.actor.schoolId, familyFeedbackOpenedSourceKey(campaignId, studentId))
  await cancelNotificationDeliveries(deps, base.actor.schoolId, familyFeedbackReminderSourceKey(campaignId, studentId, 'mid'))
  await cancelNotificationDeliveries(deps, base.actor.schoolId, familyFeedbackReminderSourceKey(campaignId, studentId, 'final'))
}

export async function cancelFamilyFeedbackCampaignNotifications(
  base: BaseSchoolService,
  campaign: FamilyFeedbackCampaign,
  slots: readonly FamilyFeedbackSlot[],
): Promise<void> {
  for (const slot of slots)
    await cancelFamilyFeedbackSlotNotifications(base, campaign.id, slot.studentId)
}

export async function notifyFamilyFeedbackOpened(
  base: BaseSchoolService,
  campaign: FamilyFeedbackCampaign,
  slots: readonly FamilyFeedbackSlot[],
  labels: { teacherName: string, subjectName: string, classGroupName: string, periodName: string, closesAtLabel: string },
): Promise<void> {
  for (const slot of slots.filter(item => !item.isCompleted)) {
    const recipients = await resolveGuardiansForStudents(
      base.repositories,
      campaign.schoolId,
      [slot.studentId],
      () => true,
      guardian => guardian.hasAccess,
    )
    if (!recipients.length)
      continue
    const student = await base.repositories.students.forSchool!(campaign.schoolId).findById(slot.studentId)
    if (!student)
      continue
    await enqueueTemplatedNotification(base, {
      idempotencyKey: familyFeedbackOpenedSourceKey(campaign.id, slot.studentId),
      schoolId: campaign.schoolId,
      kind: 'event',
      eventKey: 'family_feedback.opened',
      templateKey: 'family_feedback.opened',
      recipients,
      variables: {
        studentName: formatPersonName(student.firstName, student.lastName),
        teacherName: labels.teacherName,
        subjectName: labels.subjectName,
        classGroupName: labels.classGroupName,
        periodName: labels.periodName,
        closesAtLabel: labels.closesAtLabel,
      },
      metadata: {
        route: '/academic/family-feedback',
        campaignId: campaign.id,
        studentId: slot.studentId,
      },
    })
  }
}

export async function notifyFamilyFeedbackReminder(
  base: BaseSchoolService,
  campaign: FamilyFeedbackCampaign,
  slot: FamilyFeedbackSlot,
  kind: 'mid' | 'final',
  labels: { teacherName: string, subjectName: string, classGroupName: string, periodName: string, closesAtLabel: string },
): Promise<void> {
  const recipients = await resolveGuardiansForStudents(
    base.repositories,
    campaign.schoolId,
    [slot.studentId],
    () => true,
    guardian => guardian.hasAccess,
  )
  if (!recipients.length)
    return
  const student = await base.repositories.students.forSchool!(campaign.schoolId).findById(slot.studentId)
  if (!student)
    return
  await enqueueTemplatedNotification(base, {
    idempotencyKey: familyFeedbackReminderSourceKey(campaign.id, slot.studentId, kind),
    schoolId: campaign.schoolId,
    kind: 'job',
    eventKey: 'family_feedback.reminder',
    templateKey: 'family_feedback.reminder',
    recipients,
    variables: {
      studentName: formatPersonName(student.firstName, student.lastName),
      teacherName: labels.teacherName,
      subjectName: labels.subjectName,
      classGroupName: labels.classGroupName,
      periodName: labels.periodName,
      closesAtLabel: labels.closesAtLabel,
    },
    metadata: {
      route: '/academic/family-feedback',
      campaignId: campaign.id,
      studentId: slot.studentId,
      reminderKind: kind,
    },
  })
}

export async function notifyFamilyFeedbackPublished(
  base: BaseSchoolService,
  campaign: FamilyFeedbackCampaign,
  labels: { teacherName: string, subjectName: string, classGroupName: string, periodName: string },
): Promise<void> {
  const teacher = await base.repositories.teachers.forSchool!(campaign.schoolId).findById(campaign.teacherId)
  if (!teacher?.isActive || !teacher.subjectId)
    return
  await enqueueTemplatedNotification(base, {
    idempotencyKey: familyFeedbackPublishedSourceKey(campaign.id),
    schoolId: campaign.schoolId,
    kind: 'event',
    eventKey: 'family_feedback.published',
    templateKey: 'family_feedback.published',
    recipients: [{ kind: MessageDeliveryRecipientKind.Teacher, id: teacher.id, subjectId: teacher.subjectId }],
    variables: {
      teacherName: labels.teacherName,
      subjectName: labels.subjectName,
      classGroupName: labels.classGroupName,
      periodName: labels.periodName,
    },
    metadata: {
      route: '/teaching/family-feedback',
      campaignId: campaign.id,
      teacherId: teacher.id,
    },
  })
}

export async function notifyFamilyFeedbackPurgeWarning(
  base: BaseSchoolService,
  campaign: FamilyFeedbackCampaign,
  labels: { subjectName: string, classGroupName: string, periodName: string, purgeAtLabel: string },
  staffIds: readonly string[],
): Promise<void> {
  const recipients = []
  for (const staffId of staffIds) {
    const staff = await base.repositories.staffMembers.forSchool!(campaign.schoolId).findById(staffId)
    if (!staff?.isActive || staff.accountKind !== 'human' || !staff.subjectId)
      continue
    recipients.push({ kind: MessageDeliveryRecipientKind.Staff, id: staff.id, subjectId: staff.subjectId })
  }
  if (!recipients.length)
    return
  await enqueueTemplatedNotification(base, {
    idempotencyKey: familyFeedbackPurgeSourceKey(campaign.id),
    schoolId: campaign.schoolId,
    kind: 'job',
    eventKey: 'family_feedback.purge_reminder',
    templateKey: 'family_feedback.purge_reminder',
    recipients,
    variables: {
      subjectName: labels.subjectName,
      classGroupName: labels.classGroupName,
      periodName: labels.periodName,
      purgeAtLabel: labels.purgeAtLabel,
    },
    metadata: {
      campaignId: campaign.id,
    },
  })
}

export async function staffIdsWithCampaignManage(
  base: BaseSchoolService,
  academicYearId: string,
): Promise<string[]> {
  const grants = await base.repositories.staffPermissionAssignments.forSchool!(base.actor.schoolId).list({
    permission: Permission.FAMILY_FEEDBACK_CAMPAIGN_MANAGE,
    academicYearId,
  })
  const ids = new Set(grants.map(grant => grant.staffId))
  const school = await base.repositories.schools.findById(base.actor.schoolId)
  if (school?.ownerSubjectId) {
    const owners = await base.repositories.staffMembers.forSchool!(base.actor.schoolId).list({ subjectId: school.ownerSubjectId })
    for (const owner of owners)
      ids.add(owner.id)
  }
  return [...ids]
}
