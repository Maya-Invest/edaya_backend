import { requireNonBlank, requireValidDate } from '$lib/core/validation'

export enum IncidentKind {
  Positive = 'positive',
  MinorInfraction = 'minor_infraction',
  MajorInfraction = 'major_infraction',
  Emergency = 'emergency',
}

export interface IncidentArgs {
  id: string
  schoolId: string
  title: string
  description: string
  date: Date
  kind: IncidentKind
  reporterId: string
  createdAt?: Date
}

/**
 * Represents a logged behavior event, which can be positive (merit/award)
 * or negative (infraction/emergency).
 */
export class Incident {
  readonly id: string
  readonly schoolId: string
  readonly title: string
  readonly description: string
  readonly date: Date
  readonly kind: IncidentKind
  readonly reporterId: string
  readonly createdAt: Date

  constructor({
    id,
    schoolId,
    title,
    description,
    date,
    kind,
    reporterId,
    createdAt,
  }: IncidentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.description = requireNonBlank(description, 'description')
    this.date = requireValidDate(date, 'date')
    this.kind = kind
    this.reporterId = requireNonBlank(reporterId, 'reporterId')
    this.createdAt = createdAt ?? new Date()
  }
}
