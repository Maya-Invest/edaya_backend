import type { AnnouncementTarget, AnnouncementTargetKind } from '../entities/messaging/announcement-target'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AnnouncementTargetRepository extends BaseRepositoryInterface<AnnouncementTarget> {
  listByAnnouncement: (announcementId: string) => Promise<AnnouncementTarget[]>
  listByTarget: (targetKind: AnnouncementTargetKind, targetId: string) => Promise<AnnouncementTarget[]>
}
