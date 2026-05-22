import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '$lib/core/utils/validation'

export enum ModuleNodeKind {
  Group = 'group',
  Subject = 'subject',
}

export interface ModuleArgs {
  id: string
  classroomId: string
  kind: ModuleNodeKind
  name?: string
  weight: number
  parentModuleId?: string
  subjectId?: string
  staffId?: string
  createdAt?: Date
}

/**
 * Represents a structural module used to group subjects in a report card.
 * Modules can form a hierarchy by referencing a parentModuleId.
 */
export class Module {
  readonly id: string
  readonly classroomId: string
  readonly kind: ModuleNodeKind
  readonly name?: string
  readonly weight: number
  readonly parentModuleId?: string
  readonly subjectId?: string
  readonly staffId?: string
  readonly createdAt: Date

  constructor({ id, classroomId, kind, name, weight, parentModuleId, subjectId, staffId, createdAt }: ModuleArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.kind = kind
    this.name = requireOptionalNonBlank(name, 'name')
    this.weight = requirePositiveNumber(weight, 'weight')
    this.parentModuleId = parentModuleId ? requireNonBlank(parentModuleId, 'parentModuleId') : undefined
    this.subjectId = subjectId ? requireNonBlank(subjectId, 'subjectId') : undefined
    this.staffId = staffId ? requireNonBlank(staffId, 'staffId') : undefined
    this.createdAt = createdAt ?? new Date()

    if (this.kind === ModuleNodeKind.Group) {
      if (!this.name) {
        throw new Error('name is required for group modules')
      }
      if (this.subjectId) {
        throw new Error('group modules must not reference a subject')
      }
    }

    if (this.kind === ModuleNodeKind.Subject && !this.subjectId) {
      throw new Error('subjectId is required for subject modules')
    }
  }

  copyWith({
    name,
    weight,
    parentModuleId,
    staffId,
  }: {
    name?: string
    weight?: number
    parentModuleId?: string
    staffId?: string
  }): Module {
    return new Module({
      id: this.id,
      classroomId: this.classroomId,
      kind: this.kind,
      subjectId: this.subjectId,
      name: name ?? this.name,
      weight: weight ?? this.weight,
      parentModuleId: parentModuleId !== undefined ? parentModuleId : this.parentModuleId,
      staffId: staffId !== undefined ? staffId : this.staffId,
      createdAt: this.createdAt,
    })
  }
}
