import { z } from 'zod'

import { TimetableGenerationMode } from '../scheduling/timetable-generation-mode'
import { parseDomain, zodDate } from '../shared/utils'

export enum SchoolType {
  Primary = 'primary',
  Secondary = 'secondary',
  K12 = 'k12',
  Vocational = 'vocational',
  Other = 'other',
}

const schoolSchemaBase = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  timeZone: z.string().trim().min(1, 'timeZone must not be blank').refine((val) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: val }).format()
      return true
    }
    catch {
      return false
    }
  }, val => ({ message: `Invalid IANA time zone: ${val}` })),
  ownerSubjectId: z.string().trim().min(1, 'ownerSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  consortiumId: z.string().trim().min(1, 'consortiumId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  pendingOwnerStaffId: z.string().trim().min(1, 'pendingOwnerStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  type: z.nativeEnum(SchoolType).nullable().optional().transform(v => v === null ? undefined : v),
  country: z.string().trim().min(1, 'country must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  city: z.string().trim().min(1, 'city must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  enforceScheduleConflicts: z.boolean().default(false),
  timetableEnforceWorkloadFulfillment: z.boolean().default(true),
  timetableExcludeBreakSlots: z.boolean().default(true),
  timetableMinDayGapSameSubject: z.number().int().nonnegative('timetableMinDayGapSameSubject must be a non-negative integer').default(1),
  timetablePreferredPeriodDefinitionIds: z.array(z.string().trim().min(1, 'preferred period definition id must not be blank')).default([]),
  timetableAllowUnassignedTeacherPlacements: z.boolean().default(false),
  timetableUseHomeroomTeacherFallback: z.boolean().default(false),
  timetableGenerationMode: z.nativeEnum(TimetableGenerationMode).default(TimetableGenerationMode.Weekly),
  timetableMinPeriodSpan: z.number().int().positive('timetableMinPeriodSpan must be a strictly positive integer').default(1),
  timetableMaxPeriodSpan: z.number().int().positive('timetableMaxPeriodSpan must be a strictly positive integer').default(1),
  createdAt: zodDate().default(() => new Date()),
})

function validateSchoolPeriodSpan(
  value: { timetableMinPeriodSpan: number, timetableMaxPeriodSpan: number },
  context: z.RefinementCtx,
): void {
  if (value.timetableMaxPeriodSpan < value.timetableMinPeriodSpan) {
    context.addIssue({
      code: 'custom',
      message: 'timetableMaxPeriodSpan must be greater than or equal to timetableMinPeriodSpan',
      path: ['timetableMaxPeriodSpan'],
    })
  }
}

export const schoolSchema = schoolSchemaBase.superRefine(validateSchoolPeriodSpan)

export type SchoolData = z.infer<typeof schoolSchema>
export type SchoolInput = z.input<typeof schoolSchema>

export const schoolCreateSchema = schoolSchemaBase.omit({ createdAt: true }).superRefine(validateSchoolPeriodSpan)
export const schoolUpdateSchema = schoolSchemaBase.partial().required({ id: true }).superRefine((value, context) => {
  if (value.timetableMinPeriodSpan !== undefined
    && value.timetableMaxPeriodSpan !== undefined
    && value.timetableMaxPeriodSpan < value.timetableMinPeriodSpan) {
    validateSchoolPeriodSpan({
      timetableMinPeriodSpan: value.timetableMinPeriodSpan,
      timetableMaxPeriodSpan: value.timetableMaxPeriodSpan,
    }, context)
  }
})

/**
 * Represents the primary educational institution entity.
 * Serves as the root boundary for all other domain entities.
 */
export class School {
  readonly data: SchoolData

  constructor(args: SchoolInput) {
    this.data = parseDomain(schoolSchema, args)
  }

  get id() { return this.data.id }
  get name() { return this.data.name }
  get timeZone() { return this.data.timeZone }
  get ownerSubjectId() { return this.data.ownerSubjectId }
  get consortiumId() { return this.data.consortiumId }
  get pendingOwnerStaffId() { return this.data.pendingOwnerStaffId }
  get type() { return this.data.type }
  get country() { return this.data.country }
  get city() { return this.data.city }
  get enforceScheduleConflicts() { return this.data.enforceScheduleConflicts }
  get timetableEnforceWorkloadFulfillment() { return this.data.timetableEnforceWorkloadFulfillment }
  get timetableExcludeBreakSlots() { return this.data.timetableExcludeBreakSlots }
  get timetableMinDayGapSameSubject() { return this.data.timetableMinDayGapSameSubject }
  get timetablePreferredPeriodDefinitionIds() { return this.data.timetablePreferredPeriodDefinitionIds }
  get timetableAllowUnassignedTeacherPlacements() { return this.data.timetableAllowUnassignedTeacherPlacements }
  get timetableUseHomeroomTeacherFallback() { return this.data.timetableUseHomeroomTeacherFallback }
  get timetableGenerationMode() { return this.data.timetableGenerationMode }
  get timetableMinPeriodSpan() { return this.data.timetableMinPeriodSpan }
  get timetableMaxPeriodSpan() { return this.data.timetableMaxPeriodSpan }
  get createdAt() { return this.data.createdAt }

  get location(): string | undefined {
    const parts = [this.city, this.country].filter((value): value is string => Boolean(value))
    return parts.length > 0 ? parts.join(', ') : undefined
  }
}
