import { ModuleNodeKind } from '$lib/core/entities/academics/module'
import { requireNonBlank, requireNonNegativeNumber, roundTo2 } from '$lib/core/validation'

export interface ModuleResultArgs {
  moduleId: string
  nodeKind: ModuleNodeKind
  /** Display name: the module's own name, or the linked subject's name for leaf nodes. */
  name: string
  average: number
  weight: number
  parentModuleId?: string
  /** Populated for leaf nodes that are linked to a catalog subject. */
  subjectId?: string
  /** Nested child results (sub-modules or leaf subjects). */
  subResults?: ModuleResult[]
}

/**
 * Represents the computed result for a Module node in a classroom's curriculum hierarchy.
 * For grouping nodes (no subjectId), the average is the weighted average of subResults.
 * For leaf nodes (with subjectId), the average is derived from the student's recorded grades.
 */
export class ModuleResult {
  readonly moduleId: string
  readonly nodeKind: ModuleNodeKind
  readonly name: string
  readonly average: number
  readonly weight: number
  readonly parentModuleId?: string
  readonly subjectId?: string
  readonly subResults: readonly ModuleResult[]

  constructor({
    moduleId,
    nodeKind,
    name,
    average,
    weight,
    parentModuleId,
    subjectId,
    subResults,
  }: ModuleResultArgs) {
    this.moduleId = requireNonBlank(moduleId, 'moduleId')
    this.nodeKind = nodeKind
    this.name = requireNonBlank(name, 'name')
    this.average = roundTo2(requireNonNegativeNumber(average, 'average'))
    this.weight = requireNonNegativeNumber(weight, 'weight')
    this.parentModuleId = parentModuleId
    this.subjectId = subjectId
    this.subResults = Object.freeze(subResults ? [...subResults] : [])

    if (this.nodeKind === ModuleNodeKind.Group && this.subjectId) {
      throw new Error('group module results must not reference a subject')
    }
    if (this.nodeKind === ModuleNodeKind.Subject && !this.subjectId) {
      throw new Error('subject module results must reference a subject')
    }
  }
}
