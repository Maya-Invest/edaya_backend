import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

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

export const incidentBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  title: z.string().trim().min(1, 'title must not be blank'),
  description: z.string().trim().min(1, 'description must not be blank'),
  date: zodDate(),
  kind: z.nativeEnum(IncidentKind),
  reporterId: z.string().trim().min(1, 'reporterId must not be blank'),
  classGroupId: z.string().trim().min(1, 'classGroupId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(IncidentStatus).default(IncidentStatus.Open),
  resolutionNotes: z.string().trim().min(1, 'resolutionNotes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  resolvedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  resolvedByStaffId: z.string().trim().min(1, 'resolvedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

function refineIncident(data: any, ctx: z.RefinementCtx) {
  if ((data.resolvedAt && !data.resolvedByStaffId) || (!data.resolvedAt && data.resolvedByStaffId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'resolvedAt and resolvedByStaffId must be provided together',
    })
  }
  if (data.status === IncidentStatus.Resolved && !data.resolvedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'resolvedAt is required for resolved incidents',
    })
  }
  if (data.status === IncidentStatus.Open && (data.resolvedAt || data.resolvedByStaffId || data.resolutionNotes)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'open incidents must not define resolution fields',
    })
  }
  if (data.updatedAt.getTime() < data.createdAt.getTime()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'updatedAt must not be before createdAt',
    })
  }
}

export const incidentSchema = incidentBaseSchema.superRefine(refineIncident)

export type IncidentData = z.infer<typeof incidentSchema>
export type IncidentInput = z.input<typeof incidentSchema>

export const incidentCreateSchema = incidentBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineIncident)
export const incidentUpdateSchema = incidentBaseSchema.partial().required({ id: true }).superRefine(refineIncident)

/**
 * Represents a logged behavior event, which can be positive (merit/award)
 * or negative (infraction/emergency).
 */
export class Incident {
  readonly data: IncidentData

  constructor(args: IncidentInput) {
    this.data = parseDomain(incidentSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get title() { return this.data.title }
  get description() { return this.data.description }
  get date() { return this.data.date }
  get kind() { return this.data.kind }
  get reporterId() { return this.data.reporterId }
  get classGroupId() { return this.data.classGroupId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get status() { return this.data.status }
  get resolutionNotes() { return this.data.resolutionNotes }
  get resolvedAt() { return this.data.resolvedAt }
  get resolvedByStaffId() { return this.data.resolvedByStaffId }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
}
