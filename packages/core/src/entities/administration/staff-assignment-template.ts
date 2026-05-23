import type { StaffRole } from '$lib/core/entities/core/staff-member'
import { requireNonBlank, requireOptionalNonBlank } from '../../utils/validation'

export enum StaffAssignmentTargetKind {
  ClassGroup = 'class_group',
  ClassSubject = 'class_subject',
  Session = 'session',
  GroupedSession = 'grouped_session',
}

export interface StaffAssignmentTemplateArgs {
  id: string
  schoolId: string
  templateName: string
  role: StaffRole
  targetKind: StaffAssignmentTargetKind
  staffId?: string | null
  createdAt?: Date
}

/**
 * Represents a reusable staff assignment rule/template.
 * Can be used to quickly instantiate a standard set of roles (and optional default staff) for new entities.
 */
export class StaffAssignmentTemplate {
  readonly id: string
  readonly schoolId: string
  readonly templateName: string
  readonly role: StaffRole
  readonly targetKind: StaffAssignmentTargetKind
  readonly staffId?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    templateName,
    role,
    targetKind,
    staffId,
    createdAt,
  }: StaffAssignmentTemplateArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.templateName = requireNonBlank(templateName, 'templateName')
    this.role = role
    this.targetKind = targetKind
    this.staffId = requireOptionalNonBlank(staffId, 'staffId')
    this.createdAt = createdAt ?? new Date()
  }
}
