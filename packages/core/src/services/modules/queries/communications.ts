import type { Announcement } from '../../../entities/messaging/announcement'
import type { AnnouncementTarget } from '../../../entities/messaging/announcement-target'
import type { MessageDelivery } from '../../../entities/messaging/message-delivery'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { MessageDeliveryStatus } from '../../../entities/messaging/message-delivery'
import { denyResourceAccess } from '../../authorization'

export interface AnnouncementDeliverySummary {
  total: number
  pending: number
  sent: number
  failed: number
  read: number
  cancelled: number
}

export interface AnnouncementDetail {
  announcement: Announcement
  targets: AnnouncementTarget[]
  deliveries: MessageDelivery[]
  deliverySummary: AnnouncementDeliverySummary
}

export interface AnnouncementDirectory {
  rows: AnnouncementDetail[]
}

export class CommunicationsReadService {
  constructor(args: ServiceArgs) {
    this.announcements = args.repositories.announcements
    this.targets = args.repositories.announcementTargets
    this.deliveries = args.repositories.messageDeliveries
  }

  private readonly announcements: SchoolRepositories['announcements']
  private readonly targets: SchoolRepositories['announcementTargets']
  private readonly deliveries: SchoolRepositories['messageDeliveries']

  async listAnnouncements({ schoolId }: { schoolId: string }): Promise<AnnouncementDirectory> {
    const announcements = (await this.announcements.list({ schoolId }))
      .sort((left, right) => {
        const leftDate = left.publishedAt ?? left.createdAt
        const rightDate = right.publishedAt ?? right.createdAt
        return rightDate.getTime() - leftDate.getTime() || left.id.localeCompare(right.id)
      })
    return { rows: await Promise.all(announcements.map(announcement => this.buildDetail(announcement))) }
  }

  async getAnnouncementDetail({
    schoolId,
    announcementId,
  }: {
    schoolId: string
    announcementId: string
  }): Promise<AnnouncementDetail> {
    const announcement = await this.announcements.findById(announcementId)
    if (!announcement || announcement.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return this.buildDetail(announcement)
  }

  private async buildDetail(announcement: Announcement): Promise<AnnouncementDetail> {
    const [targets, deliveries] = await Promise.all([
      this.targets.list({ announcementId: announcement.id }),
      this.deliveries.list({ announcementId: announcement.id }),
    ])
    targets.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    deliveries.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return {
      announcement,
      targets,
      deliveries,
      deliverySummary: deliveries.reduce<AnnouncementDeliverySummary>((summary, delivery) => {
        summary.total += 1
        switch (delivery.status) {
          case MessageDeliveryStatus.Pending:
            summary.pending += 1
            break
          case MessageDeliveryStatus.Sent:
            summary.sent += 1
            break
          case MessageDeliveryStatus.Failed:
            summary.failed += 1
            break
          case MessageDeliveryStatus.Read:
            summary.read += 1
            break
          case MessageDeliveryStatus.Cancelled:
            summary.cancelled += 1
            break
        }
        return summary
      }, { total: 0, pending: 0, sent: 0, failed: 0, read: 0, cancelled: 0 }),
    }
  }
}
