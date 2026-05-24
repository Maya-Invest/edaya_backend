import { requireNonBlank } from '$lib/core/utils/validation'

export enum AnnouncementTargetKind {
  ClassGroup = 'class_group',
  GradeLevel = 'grade_level',
  Staff = 'staff',
  Guardian = 'guardian',
  Student = 'student',
}

export interface AnnouncementTargetArgs {
  id: string
  announcementId: string
  targetKind: AnnouncementTargetKind
  targetId: string
  createdAt?: Date
}

/**
 * Resolves a published or custom announcement to a concrete audience target.
 */
export class AnnouncementTarget {
  readonly id: string
  readonly announcementId: string
  readonly targetKind: AnnouncementTargetKind
  readonly targetId: string
  readonly createdAt: Date

  constructor({ id, announcementId, targetKind, targetId, createdAt }: AnnouncementTargetArgs) {
    this.id = requireNonBlank(id, 'id')
    this.announcementId = requireNonBlank(announcementId, 'announcementId')
    this.targetKind = targetKind
    this.targetId = requireNonBlank(targetId, 'targetId')
    this.createdAt = createdAt ?? new Date()
  }
}
