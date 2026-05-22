import { ModuleNodeKind } from '$lib/core/entities/academics/module'
import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '../../utils/validation'

export interface CurriculumArgs {
  id: string
  schoolId: string
  gradeLevelId: string
  academicYearId: string
  name: string
  description?: string | null
  createdAt?: Date
}

export class Curriculum {
  readonly id: string
  readonly schoolId: string
  readonly gradeLevelId: string
  readonly academicYearId: string
  readonly name: string
  readonly description?: string
  readonly createdAt: Date

  constructor({ id, schoolId, gradeLevelId, academicYearId, name, description, createdAt }: CurriculumArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.gradeLevelId = requireNonBlank(gradeLevelId, 'gradeLevelId')
    this.academicYearId = requireNonBlank(academicYearId, 'academicYearId')
    this.name = requireNonBlank(name, 'name')
    this.description = requireOptionalNonBlank(description, 'description')
    this.createdAt = createdAt ?? new Date()
  }
}

export interface CurriculumNodeArgs {
  id: string
  curriculumId: string
  kind: ModuleNodeKind
  name?: string | null
  weight: number
  parentCurriculumNodeId?: string | null
  subjectId?: string | null
  createdAt?: Date
}

export class CurriculumNode {
  readonly id: string
  readonly curriculumId: string
  readonly kind: ModuleNodeKind
  readonly name?: string
  readonly weight: number
  readonly parentCurriculumNodeId?: string
  readonly subjectId?: string
  readonly createdAt: Date

  constructor({
    id,
    curriculumId,
    kind,
    name,
    weight,
    parentCurriculumNodeId,
    subjectId,
    createdAt,
  }: CurriculumNodeArgs) {
    this.id = requireNonBlank(id, 'id')
    this.curriculumId = requireNonBlank(curriculumId, 'curriculumId')
    this.kind = kind
    this.name = requireOptionalNonBlank(name, 'name')
    this.weight = requirePositiveNumber(weight, 'weight')
    this.parentCurriculumNodeId = parentCurriculumNodeId ? requireNonBlank(parentCurriculumNodeId, 'parentCurriculumNodeId') : undefined
    this.subjectId = subjectId ? requireNonBlank(subjectId, 'subjectId') : undefined
    this.createdAt = createdAt ?? new Date()

    if (this.kind === ModuleNodeKind.Group) {
      if (!this.name) {
        throw new Error('name is required for group nodes')
      }
      if (this.subjectId) {
        throw new Error('group nodes must not reference a subject')
      }
    }

    if (this.kind === ModuleNodeKind.Subject && !this.subjectId) {
      throw new Error('subjectId is required for subject nodes')
    }
  }
}
