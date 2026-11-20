import type { Announcement } from '@edaya/core'
import type { StoreDatabase } from '../postgres-store'
import type { EntityStores } from './entity-stores-types'
import {
  Announcement as AnnouncementCtor,
  AnnouncementPriority,
  AnnouncementStatus,
  AnnouncementTarget as AnnouncementTargetCtor,
  MessageDelivery as MessageDeliveryCtor,
} from '@edaya/core'
import { customStore, defaultStore } from '../lib/store-factory'
import * as schema from '../postgres-schema'
import {
  enumValue,
} from './entity-store-helpers'

export function createMessagingEntityStores(db: StoreDatabase): Pick<EntityStores, 'announcements' | 'announcementTargets' | 'messageDeliveries'> {
  return {
    announcements: customStore(
      db,
      schema.announcements,
      (entity: Announcement) => ({
        id: entity.id,
        schoolId: entity.schoolId,
        title: entity.title,
        content: entity.content,
        createdBy: entity.createdBy ?? null,
        status: entity.status,
        priority: entity.priority,
        createdAt: entity.createdAt,
        publishedAt: entity.publishedAt ?? null,
        expiresAt: entity.expiresAt ?? null,
      }),
      row => new AnnouncementCtor({
        id: row.id,
        schoolId: row.schoolId,
        title: row.title,
        content: row.content,
        createdBy: row.createdBy,
        status: enumValue(AnnouncementStatus, row.status, 'announcements.status'),
        priority: enumValue(AnnouncementPriority, row.priority, 'announcements.priority'),
        createdAt: row.createdAt,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
      }),
    ),

    announcementTargets: defaultStore(db, schema.announcementTargets, AnnouncementTargetCtor),

    messageDeliveries: defaultStore(db, schema.messageDeliveries, MessageDeliveryCtor),
  }
}
