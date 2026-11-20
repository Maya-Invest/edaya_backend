import { z } from 'zod'
import { reportSettingsSchema } from '../assessments/report-module'

import { parseDomain, zodDate } from '../shared/utils'
import { shortNameSchema } from '../shared/visible-identification'
import { currentGradingPolicy, gradingPolicySchema } from './grading-policy'

export const gradeLevelSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  reportSettings: z.array(reportSettingsSchema).default([]),
  gradingPolicies: z.array(gradingPolicySchema).default([]),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  /** Short human-readable stem used to build class names (e.g. `6ème` for `6ème 1`). */
  shortName: shortNameSchema.optional(),
  order: z.number().int('order must be a strictly positive integer').positive('order must be a strictly positive integer'),
  cycle: z.string().trim().min(1, 'cycle must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type GradeLevelData = z.infer<typeof gradeLevelSchema>
export type GradeLevelInput = z.input<typeof gradeLevelSchema>

export const gradeLevelCreateSchema = gradeLevelSchema.omit({ createdAt: true })
export const gradeLevelUpdateSchema = gradeLevelSchema.partial().required({ id: true })

/**
 * Represents a formal grade level in the school's progression ladder
 * (e.g., CP1, CE1, Grade 10). ClassGroups reference a GradeLevel
 * to provide structured level tracking and promotion logic.
 */
export class GradeLevel {
  readonly data: GradeLevelData

  copyWith(changes: Partial<GradeLevelInput>): GradeLevel { return new GradeLevel({ ...this.data, ...changes }) }

  constructor(args: GradeLevelInput) {
    this.data = parseDomain(gradeLevelSchema, args)
  }

  get id() { return this.data.id }
  get reportSettings() { return this.data.reportSettings }
  reportSettingsFor(academicYearId: string) { return this.reportSettings.find(row => row.academicYearId === academicYearId) ?? { academicYearId, revision: 0 } }
  get gradingPolicies() { return this.data.gradingPolicies }
  gradingPolicyFor(academicYearId: string) { return currentGradingPolicy(this.gradingPolicies, academicYearId) }
  get schoolId() { return this.data.schoolId }
  get name() { return this.data.name }
  get shortName() { return this.data.shortName ?? this.name }
  get order() { return this.data.order }
  get cycle() { return this.data.cycle }
  get createdAt() { return this.data.createdAt }
}
