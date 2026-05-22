import { ModuleNodeKind } from '$lib/core/entities/academics/module'
import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '../../utils/validation'

export interface ModuleTemplateArgs {
  id: string
  schoolId: string
  name: string
  description?: string | null
  createdAt?: Date
}

/**
 * Represents a reusable module structure template for a school.
 */
export class ModuleTemplate {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly description?: string
  readonly createdAt: Date

  constructor({ id, schoolId, name, description, createdAt }: ModuleTemplateArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.description = requireOptionalNonBlank(description, 'description')
    this.createdAt = createdAt ?? new Date()
  }
}

export interface ModuleTemplateNodeArgs {
  id: string
  templateId: string
  kind: ModuleNodeKind
  name?: string | null
  weight: number
  parentTemplateNodeId?: string | null
  subjectId?: string | null
  staffId?: string | null
  createdAt?: Date
}

/**
 * Represents a node in a reusable module structure template.
 */
export class ModuleTemplateNode {
  readonly id: string
  readonly templateId: string
  readonly kind: ModuleNodeKind
  readonly name?: string
  readonly weight: number
  readonly parentTemplateNodeId?: string
  readonly subjectId?: string
  readonly staffId?: string
  readonly createdAt: Date

  constructor({
    id,
    templateId,
    kind,
    name,
    weight,
    parentTemplateNodeId,
    subjectId,
    staffId,
    createdAt,
  }: ModuleTemplateNodeArgs) {
    this.id = requireNonBlank(id, 'id')
    this.templateId = requireNonBlank(templateId, 'templateId')
    this.kind = kind
    this.name = requireOptionalNonBlank(name, 'name')
    this.weight = requirePositiveNumber(weight, 'weight')
    this.parentTemplateNodeId = parentTemplateNodeId ? requireNonBlank(parentTemplateNodeId, 'parentTemplateNodeId') : undefined
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
}
