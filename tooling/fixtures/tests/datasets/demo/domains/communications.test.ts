import type { AnnouncementInput, AnnouncementTargetInput, MessageDeliveryInput } from '@edaya/core'
import { AnnouncementStatus } from '@edaya/core'
import { describe, expect, it } from 'bun:test'
import {
  demoAnnouncementMaterializePlans,
  demoAnnouncements,
  demoAnnouncementTargets,
  demoMessageDeliveries,
} from '../../../../src/datasets/demo/domains/communications'

describe('demo communications', () => {
  it('typed announcements satisfy AnnouncementInput', () => {
    const announcement = demoAnnouncements[0] satisfies AnnouncementInput
    expect(announcement.status).toBe(AnnouncementStatus.Published)
  })

  it('typed targets satisfy AnnouncementTargetInput', () => {
    const target = demoAnnouncementTargets[0] satisfies AnnouncementTargetInput
    expect(target.announcementId).toBe('ann-rentree')
  })

  it('typed deliveries satisfy MessageDeliveryInput', () => {
    const delivery = demoMessageDeliveries[0] satisfies MessageDeliveryInput
    expect(delivery.announcementId).toBe('ann-parent-meeting')
  })

  it('includes three announcement materialize plans', () => {
    expect(demoAnnouncementMaterializePlans).toHaveLength(3)
  })
})
