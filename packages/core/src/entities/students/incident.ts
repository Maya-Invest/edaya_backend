import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum IncidentKind {
  Positive = 'positive',
  MinorInfraction = 'minor_infraction',
  MajorInfraction = 'major_infraction',
  Emergency = 'emergency',
}

export enum IncidentStatus {
  Open = 'open',
  Resolved = 'resolved',
  Cancelled = 'cancelled',
}

export interface IncidentArgs {
  id: string
  schoolId: string
  title: string
  description: string
  date: Date
  kind: IncidentKind
  reporterId: string
  classGroupId?: string | null
  sessionId?: string | null
  status?: IncidentStatus
  resolutionNotes?: string | null
  resolvedAt?: Date | null
  resolvedByStaffId?: string | null
  createdAt?: Date
  updatedAt?: Date
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
  readonly classGroupId?: string
  readonly sessionId?: string
  readonly status: IncidentStatus
  readonly resolutionNotes?: string
  readonly resolvedAt?: Date
  readonly resolvedByStaffId?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    title,
    description,
    date,
    kind,
    reporterId,
    classGroupId,
    sessionId,
    status = IncidentStatus.Open,
    resolutionNotes,
    resolvedAt,
    resolvedByStaffId,
    createdAt,
    updatedAt,
  }: IncidentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.description = requireNonBlank(description, 'description')
    this.date = requireValidDate(date, 'date')
    this.kind = kind
    this.reporterId = requireNonBlank(reporterId, 'reporterId')
    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.status = status
    this.resolutionNotes = requireOptionalNonBlank(resolutionNotes, 'resolutionNotes')
    this.resolvedAt = resolvedAt ? requireValidDate(resolvedAt, 'resolvedAt') : undefined
    this.resolvedByStaffId = requireOptionalNonBlank(resolvedByStaffId, 'resolvedByStaffId')
    const now = new Date()
    this.createdAt = createdAt ?? now
    this.updatedAt = updatedAt ?? now

    if ((this.resolvedAt && !this.resolvedByStaffId) || (!this.resolvedAt && this.resolvedByStaffId)) {
      throw new Error('resolvedAt and resolvedByStaffId must be provided together')
    }
    if (this.status === IncidentStatus.Resolved && !this.resolvedAt) {
      throw new Error('resolvedAt is required for resolved incidents')
    }
    if (this.status === IncidentStatus.Open && (this.resolvedAt || this.resolvedByStaffId || this.resolutionNotes)) {
      throw new Error('open incidents must not define resolution fields')
    }
    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
}
