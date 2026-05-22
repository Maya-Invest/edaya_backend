import { requireNonBlank, requirePositiveNumber } from '$lib/core/utils/validation'

export enum ModuleNodeKind {
  Group = 'group',
  Subject = 'subject',
}

export interface ModuleArgs {
  id: string
  classroomId: string
  name: string
  weight: number
  parentModuleId?: string | null
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
  readonly name: string
  readonly weight: number
  readonly parentModuleId?: string
  readonly createdAt: Date

  constructor({ id, classroomId, name, weight, parentModuleId, createdAt }: ModuleArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classroomId = requireNonBlank(classroomId, 'classroomId')
    this.kind = ModuleNodeKind.Group
    this.name = requireNonBlank(name, 'name')
    this.weight = requirePositiveNumber(weight, 'weight')
    this.parentModuleId = parentModuleId ? requireNonBlank(parentModuleId, 'parentModuleId') : undefined
    this.createdAt = createdAt ?? new Date()
  }

  copyWith({
    name,
    weight,
    parentModuleId,
  }: {
    name?: string
    weight?: number
    parentModuleId?: string
  }): Module {
    return new Module({
      id: this.id,
      classroomId: this.classroomId,
      name: name ?? this.name,
      weight: weight ?? this.weight,
      parentModuleId: parentModuleId !== undefined ? parentModuleId : this.parentModuleId,
      createdAt: this.createdAt,
    })
  }
}
