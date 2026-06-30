import type { InteractiveActorMetadata } from '../authorization'
import type { SchoolRepositories } from '../ports'
import type { NotificationRecipient, NotificationRecipientProfile } from '../ports/notification-gateway'
import type { BaseSchoolService } from '../services/base-school-service'
import {
  buildGuardianRecipientProfile,
  buildStaffRecipientProfile,
  buildStudentRecipientProfile,
} from './build-recipient-profile'
import { enrichRecipientProfile } from './resolve-notification-contact'

export async function upsertNotificationRecipient(
  baseService: BaseSchoolService,
  profile: NotificationRecipientProfile | undefined,
): Promise<void> {
  if (!profile?.recipient.subjectId) {
    return
  }

  const subjectId = profile.recipient.subjectId
  const authContact = await baseService.authContactResolver?.resolveBySubjectId(subjectId)
  const enriched = enrichRecipientProfile(profile, authContact)
  await baseService.notificationGateway.upsertRecipient(enriched)
}

export function scheduleNotificationRecipientUpsert(
  baseService: BaseSchoolService,
  profile: NotificationRecipientProfile | undefined,
): void {
  void upsertNotificationRecipient(baseService, profile).catch(() => {
    // Provider sync must not break business commands.
  })
}

export async function resolveNotificationRecipientProfileForActor(
  repositories: SchoolRepositories,
  actor: InteractiveActorMetadata,
): Promise<NotificationRecipientProfile | undefined> {
  switch (actor.kind) {
    case 'staff': {
      const staff = await repositories.staffMembers.findById(actor.staffMemberId)
      if (!staff || staff.schoolId !== actor.schoolId) {
        return undefined
      }
      return buildStaffRecipientProfile(staff)
    }
    case 'guardian': {
      const guardian = await repositories.guardians.findById(actor.guardianId)
      if (!guardian || guardian.schoolId !== actor.schoolId) {
        return undefined
      }
      const links = await repositories.guardianLinks.list({ guardianId: guardian.id })
      return buildGuardianRecipientProfile(guardian, links)
    }
    case 'student': {
      const student = await repositories.students.findById(actor.studentId)
      if (!student || student.schoolId !== actor.schoolId) {
        return undefined
      }
      return buildStudentRecipientProfile(student)
    }
  }
}

export async function ensureNotificationRecipientForActor(
  baseService: BaseSchoolService,
  actor: InteractiveActorMetadata,
): Promise<void> {
  const profile = await resolveNotificationRecipientProfileForActor(
    baseService.repositories,
    actor,
  )
  await upsertNotificationRecipient(baseService, profile)
}

export function scheduleNotificationRecipientBackfillForActor(
  baseService: BaseSchoolService,
  actor: InteractiveActorMetadata,
): void {
  void ensureNotificationRecipientForActor(baseService, actor).catch(() => {
    // Provider sync must not break session bootstrap.
  })
}

export function scheduleNotificationRecipientRemove(
  baseService: BaseSchoolService,
  schoolId: string,
  recipient: NotificationRecipient,
): void {
  if (!recipient.subjectId) {
    return
  }
  void baseService.notificationGateway.removeRecipient(schoolId, recipient)
}
