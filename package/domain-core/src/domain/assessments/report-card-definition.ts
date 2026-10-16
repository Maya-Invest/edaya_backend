import { z } from 'zod'

import { parseDomain, zodDate } from '../shared/utils'

export enum ReportCardDefinitionKind {
  Default = 'default',
  Custom = 'custom',
}

export enum ReportCardDefinitionStatus {
  Draft = 'draft',
  Published = 'published',
}

export const reportCardDefinitionSchema = z.object({
  revision: z.number().int().nonnegative().default(0),
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  gradeLevelId: z.string().trim().min(1, 'gradeLevelId must not be blank'),
  gradeScaleId: z.string().trim().min(1, 'gradeScaleId must not be blank'),
  passThreshold: z.number().finite().nonnegative().nullable().optional().transform(v => v === null ? undefined : v),
  name: z.string().trim().min(1, 'name must not be blank'),
  kind: z.nativeEnum(ReportCardDefinitionKind).default(ReportCardDefinitionKind.Custom),
  status: z.nativeEnum(ReportCardDefinitionStatus).default(ReportCardDefinitionStatus.Draft),
  isDefault: z.boolean().default(false),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type ReportCardDefinitionData = z.infer<typeof reportCardDefinitionSchema>
export type ReportCardDefinitionInput = z.input<typeof reportCardDefinitionSchema>

export const reportCardDefinitionCreateSchema = reportCardDefinitionSchema.omit({ createdAt: true })
export const reportCardDefinitionUpdateSchema = reportCardDefinitionSchema.partial().required({ id: true })

/**
 * Represents a reusable report-card template for a grade level.
 * Sections define the hierarchy, weights, and subject mappings used when
 * generating report-card results.
 */
export class ReportCardDefinition {
  readonly data: ReportCardDefinitionData

  constructor(args: ReportCardDefinitionInput) {
    this.data = parseDomain(reportCardDefinitionSchema, args)
  }

  get passThreshold() { return this.data.passThreshold }
  get revision() { return this.data.revision }
  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get academicYearId() { return this.data.academicYearId }
  get gradeLevelId() { return this.data.gradeLevelId }
  get gradeScaleId() { return this.data.gradeScaleId }
  get name() { return this.data.name }
  get kind() { return this.data.kind }
  get status() { return this.data.status }
  get isDefault() { return this.data.isDefault }
  get description() { return this.data.description }
  get createdAt() { return this.data.createdAt }
}
