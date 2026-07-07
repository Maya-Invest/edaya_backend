import type { AuthLinkSeedPort } from '../auth-link/port'
import type { CommunicationsSeedPort, MessageDeliverySeedRecord } from './port'
import { MessageDeliveryRecipientKind, MessageDeliveryStatus } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedAuthLinkedGuardianInboxProbes } from './guardian-inbox-probe'

describe('seedAuthLinkedGuardianInboxProbes', () => {
  test('records unread deliveries using auth-linked guardian subject ids', async () => {
    const deliveries: MessageDeliverySeedRecord[] = []
    const communicationsPort: CommunicationsSeedPort = {
      createAnnouncement: async () => {},
      addTarget: async () => {},
      publishAnnouncement: async () => {},
      materializeDeliveries: async () => 0,
      recordDelivery: async record => void deliveries.push(record),
    }
    const authLinkPort: AuthLinkSeedPort = {
      findSchoolById: async () => ({ id: demoCiDataset.schoolId }),
      setSchoolOwnerSubjectId: async () => {},
      findStaffById: async () => undefined,
      registerStaffMember: async () => {},
      replaceStaffSubjectId: async () => {},
      findGuardianById: async id => ({
        id,
        subjectId: id === 'ci-g1' ? 'auth-subject-g1' : undefined,
      }),
      findTeacherById: async () => undefined,
      replaceGuardianSubjectId: async () => {},
      linkActorSubject: async () => {},
    }

    const recorded = await seedAuthLinkedGuardianInboxProbes(
      communicationsPort,
      authLinkPort,
      demoCiDataset,
      ['ci-g1', 'ci-g4'],
    )

    expect(recorded).toBe(1)
    expect(deliveries).toHaveLength(1)
    expect(deliveries[0]).toMatchObject({
      id: 'ci-g1-inbox-probe',
      subjectId: 'auth-subject-g1',
      recipientId: 'ci-g1',
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      status: MessageDeliveryStatus.Sent,
      announcementId: 'ci-ann-parent-meeting',
    })
    expect(deliveries[0]?.readAt).toBeUndefined()
  })
})
