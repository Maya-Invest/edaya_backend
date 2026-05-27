import { requireNonBlank, requireOptionalNonBlank } from '../utils'

export enum AnnouncementTargetKind {
  School = 'school',
  AllStaff = 'all_staff',
  AllGuardians = 'all_guardians',
  AllStudents = 'all_students',
  ClassGroup = 'class_group',
  GradeLevel = 'grade_level',
  StaffMember = 'staff_member',
  Guardian = 'guardian',
  Student = 'student',
}

export interface AnnouncementTargetArgs {
  id: string
  announcementId: string
  targetKind: AnnouncementTargetKind
  targetId?: string | null
  createdAt?: Date
}

/**
 * Resolves a published or custom announcement to a concrete audience target.
 */
export class AnnouncementTarget {
  readonly id: string
  readonly announcementId: string
  readonly targetKind: AnnouncementTargetKind
  readonly targetId?: string
  readonly createdAt: Date

  constructor({ id, announcementId, targetKind, targetId, createdAt }: AnnouncementTargetArgs) {
    this.id = requireNonBlank(id, 'id')
    this.announcementId = requireNonBlank(announcementId, 'announcementId')
    this.targetKind = targetKind
    this.targetId = requireOptionalNonBlank(targetId, 'targetId')
    this.createdAt = createdAt ?? new Date()

    const isBroadcast = [
      AnnouncementTargetKind.School,
      AnnouncementTargetKind.AllStaff,
      AnnouncementTargetKind.AllGuardians,
      AnnouncementTargetKind.AllStudents,
    ].includes(this.targetKind)
    if (isBroadcast && this.targetId) {
      throw new Error('broadcast announcement targets must not define targetId')
    }
    if (!isBroadcast && !this.targetId) {
      throw new Error('scoped announcement targets must define targetId')
    }
  }
}
