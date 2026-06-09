import { describe, expect, test } from 'bun:test'
import { Announcement, AnnouncementPriority, AnnouncementStatus } from '../../../../src/domains/messaging/announcement'

describe('Announcement entity', () => {
  test('instantiates successfully with valid inputs', () => {
    const ann = new Announcement({
      id: 'ann1',
      schoolId: 'sch1',
      title: 'Welcome',
      content: 'Welcome back!',
    })

    expect(ann.id).toBe('ann1')
    expect(ann.schoolId).toBe('sch1')
    expect(ann.title).toBe('Welcome')
    expect(ann.status).toBe(AnnouncementStatus.Draft)
    expect(ann.priority).toBe(AnnouncementPriority.Normal)
    expect(ann.isPublished).toBe(false)
    expect(ann.effectiveDate).toBeInstanceOf(Date)
    expect(ann.effectiveDate).toBe(ann.createdAt)
  })

  test('handles published status correctly', () => {
    const publishedAt = new Date('2026-09-01')
    const ann = new Announcement({
      id: 'ann2',
      schoolId: 'sch1',
      title: 'Update',
      content: 'Update info',
      publishedAt,
    })

    expect(ann.status).toBe(AnnouncementStatus.Published)
    expect(ann.isPublished).toBe(true)
    expect(ann.effectiveDate).toBe(publishedAt)
  })

  test('throws error if published without publishedAt date', () => {
    expect(() => {
      new Announcement({
        id: 'ann3',
        schoolId: 'sch1',
        title: 'Error',
        content: 'Error info',
        status: AnnouncementStatus.Published,
      })
    }).toThrow('publishedAt is required for published announcements')
  })

  test('throws error if draft with publishedAt date', () => {
    expect(() => {
      new Announcement({
        id: 'ann4',
        schoolId: 'sch1',
        title: 'Error',
        content: 'Error info',
        status: AnnouncementStatus.Draft,
        publishedAt: new Date(),
      })
    }).toThrow('draft announcements must not define publishedAt')
  })

  test('throws error if expiresAt is before publishedAt', () => {
    expect(() => {
      new Announcement({
        id: 'ann5',
        schoolId: 'sch1',
        title: 'Error',
        content: 'Error info',
        publishedAt: new Date('2026-09-02'),
        expiresAt: new Date('2026-09-01'),
      })
    }).toThrow('expiresAt must not be before publishedAt')
  })
})
