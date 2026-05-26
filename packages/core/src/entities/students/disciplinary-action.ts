import { requireNonBlank, requireOptionalNonBlank, requirePositiveInt, requirePositiveNumber } from '../utils'

export enum DisciplinaryActionKind {
  Sanction = 'sanction',
  Reward = 'reward',
}

export interface DisciplinaryActionArgs {
  id: string
  schoolId: string
  name: string
  kind: DisciplinaryActionKind
  severity?: number | null
  defaultDurationDays?: number | null
  description?: string | null
  createdAt?: Date
}

/**
 * Defines a standardized disciplinary action in the school's catalog.
 * Used to formalize possible sanctions (warning, detention, suspension)
 * and rewards (merit badge, commendation) applied to students via incidents.
 */
export class DisciplinaryAction {
  readonly id: string
  readonly schoolId: string
  readonly name: string
  readonly kind: DisciplinaryActionKind
  readonly severity?: number
  readonly defaultDurationDays?: number
  readonly description?: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    name,
    kind,
    severity,
    defaultDurationDays,
    description,
    createdAt,
  }: DisciplinaryActionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.name = requireNonBlank(name, 'name')
    this.kind = kind
    if (severity != null) {
      this.severity = requirePositiveNumber(severity, 'severity')
    }
    if (defaultDurationDays != null) {
      this.defaultDurationDays = requirePositiveInt(defaultDurationDays, 'defaultDurationDays')
    }
    this.description = requireOptionalNonBlank(description, 'description')
    this.createdAt = createdAt ?? new Date()
  }
}
