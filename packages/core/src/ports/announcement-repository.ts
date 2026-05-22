import type { Announcement } from '$lib/core/entities/core/announcement'
import type { BaseRepositoryInterface } from './_base-repository'

export interface AnnouncementRepository extends BaseRepositoryInterface<Announcement> {
  listBySchool: (schoolId: string) => Promise<Announcement[]>
}
