import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'

export const reportModuleWeightingModeSchema = z.enum(['subject_coefficients', 'explicit'])
export type ReportModuleWeightingMode = z.infer<typeof reportModuleWeightingModeSchema>

export const reportModuleBaseSchema = z.object({
  id: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
  gradeLevelId: z.string().trim().min(1),
  academicYearId: z.string().trim().min(1),
  name: z.string().trim().min(1),
  order: z.number().int().positive(),
  weightingMode: reportModuleWeightingModeSchema.default('subject_coefficients'),
  explicitWeight: z.number().finite().positive().nullish().transform(value => value ?? undefined),
  createdAt: zodDate().default(() => new Date()),
})

export const reportModuleSchema = reportModuleBaseSchema.superRefine((value, context) => {
  if ((value.weightingMode === 'explicit') !== (value.explicitWeight !== undefined))
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['explicitWeight'], message: 'Explicit mode requires a positive weight; coefficient-sum mode must not specify one' })
})
export type ReportModuleInput = z.input<typeof reportModuleSchema>
export type ReportModuleData = z.infer<typeof reportModuleSchema>

/** One flat result group belonging to one grade level and academic year. */
export class ReportModule {
  readonly data: ReportModuleData
  constructor(input: ReportModuleInput) { this.data = parseDomain(reportModuleSchema, input) }
  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get gradeLevelId() { return this.data.gradeLevelId }
  get academicYearId() { return this.data.academicYearId }
  get name() { return this.data.name }
  get order() { return this.data.order }
  get weightingMode() { return this.data.weightingMode }
  get explicitWeight() { return this.data.explicitWeight }
  get createdAt() { return this.data.createdAt }
}

export const reportSettingsSchema = z.object({
  academicYearId: z.string().trim().min(1),
  revision: z.number().int().nonnegative().default(0),
  passThreshold: z.number().finite().nonnegative().nullish().transform(value => value ?? undefined),
})
export type ReportSettings = z.infer<typeof reportSettingsSchema>
