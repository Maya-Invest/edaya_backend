import type { FixtureDataset } from '@edaya/fixtures'
import type { AuthLinkSeedPort } from '../auth-link/port'
import type { CommunicationsSeedPort } from './port'
import { AnnouncementTargetKind, MessageDeliveryRecipientKind, MessageDeliveryStatus } from '@edaya/core'
import { seedDateAndMinute } from './workflow'

function resolveInboxProbeAnnouncement(dataset: FixtureDataset) {
  const announcements = dataset.entities.announcements ?? []
  const targets = dataset.entities.announcementTargets ?? []

  const allGuardiansTarget = targets.find(
    target => target.targetKind === AnnouncementTargetKind.AllGuardians,
  )
  if (allGuardiansTarget) {
    const match = announcements.find(
      announcement => announcement.id === allGuardiansTarget.announcementId,
    )
    if (match) {
      return match
    }
  }

  const match = announcements.find(announcement =>
    announcement.title.includes('Réunion parents-professeurs'),
  )
  if (!match) {
    throw new Error(
      'Guardian inbox probe seed requires an AllGuardians announcement or parent-meeting announcement in the dataset',
    )
  }
  return match
}

/**
 * Records unread inbox deliveries keyed to each auth-linked guardian's current subjectId.
 * Profiles without a central identity link receive no delivery until that link exists.
 *
 * Uses the school-wide guardians announcement when present so every linked guardian is eligible.
 */
export async function seedAuthLinkedGuardianInboxProbes(
  communicationsPort: CommunicationsSeedPort,
  authLinkPort: AuthLinkSeedPort,
  dataset: FixtureDataset,
  guardianIds: readonly string[],
): Promise<number> {
  const announcement = resolveInboxProbeAnnouncement(dataset)
  const sentAt = seedDateAndMinute('2026-01-28T18:05:00.000Z')
  let recorded = 0

  for (const guardianId of guardianIds) {
    const guardian = await authLinkPort.findGuardianById(guardianId)
    if (!guardian?.subjectId) {
      continue
    }

    await communicationsPort.recordDelivery({
      id: `${guardianId}-inbox-probe`,
      schoolId: dataset.schoolId,
      announcementId: announcement.id,
      subjectId: guardian.subjectId,
      title: announcement.title,
      body: announcement.content,
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: guardianId,
      status: MessageDeliveryStatus.Sent,
      sentAt,
      readAt: undefined,
      failureReason: undefined,
    })
    recorded += 1
  }

  return recorded
}
