import type { Announcement } from '../../../../entities/messaging/announcement'
import type { EntityConfigFactory } from '../../../shared/common'
import { directEntityConfig } from '../../../shared/common'

export const announcementConfig: EntityConfigFactory<Announcement> = input =>
  directEntityConfig(input, input.repositories.announcements, 'queries.read_communications', 'communications.manage')
