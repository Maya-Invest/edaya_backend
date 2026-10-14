import { z } from 'zod'

import { SCHOOL_CREST_PURPOSE, SCHOOL_LOGO_PURPOSE } from '../documents/document-failures'
import { TimetableGenerationMode } from '../scheduling/timetable-generation-mode'
import { parseDomain, zodDate } from '../shared/utils'

export function deriveSchoolShortName(name: string): string {
  for (const separator of ['—', ' - ']) {
    const parts = name.split(separator)
    if (parts.length > 1 && parts.at(-1)?.trim())
      return parts.at(-1)!.trim()
  }
  return name.trim().split(/\s+/)[0] ?? name.trim()
}

const schoolSchemaBase = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  shortName: z.string().trim().min(1, 'shortName must not be blank').optional(),
  timeZone: z.string().trim().min(1, 'timeZone must not be blank').refine((val) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: val }).format()
      return true
    }
    catch {
      return false
    }
  }, val => ({ message: `Invalid IANA time zone: ${val}` })),
  financeCurrency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/).optional(),
  ownerSubjectId: z.string().trim().min(1, 'ownerSubjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  consortiumId: z.string().trim().min(1, 'consortiumId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  pendingOwnerStaffId: z.string().trim().min(1, 'pendingOwnerStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
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
  postalAddress: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  phone: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  email: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  schoolCode: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  issuingName: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  logoAttachmentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  crestAttachmentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  stampAttachmentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  signatureAttachmentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  issuanceAssetVersion: z.number().int().nonnegative().default(0),
  publicBrandingPurposes: z.array(z.enum([SCHOOL_LOGO_PURPOSE, SCHOOL_CREST_PURPOSE])).default([]).transform(purposes => [...new Set(purposes)]),
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
    this.data = parseDomain(schoolSchema, { ...args, shortName: args.shortName ?? deriveSchoolShortName(args.name) })
  }

  get id() { return this.data.id }
  get name() { return this.data.name }
  get timeZone() { return this.data.timeZone }
  get financeCurrency() { return this.data.financeCurrency }
  get ownerSubjectId() { return this.data.ownerSubjectId }
  get consortiumId() { return this.data.consortiumId }
  get pendingOwnerStaffId() { return this.data.pendingOwnerStaffId }
  get shortName() { return this.data.shortName ?? deriveSchoolShortName(this.name) }
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
  get postalAddress() { return this.data.postalAddress }
  get phone() { return this.data.phone }
  get email() { return this.data.email }
  get schoolCode() { return this.data.schoolCode }
  get issuingName() { return this.data.issuingName }
  get logoAttachmentId() { return this.data.logoAttachmentId }
  get crestAttachmentId() { return this.data.crestAttachmentId }
  get stampAttachmentId() { return this.data.stampAttachmentId }
  get signatureAttachmentId() { return this.data.signatureAttachmentId }
  get issuanceAssetVersion() { return this.data.issuanceAssetVersion }
  get publicBrandingPurposes() { return this.data.publicBrandingPurposes }
  get createdAt() { return this.data.createdAt }

  get location(): string | undefined {
    const parts = [this.city, this.country].filter((value): value is string => Boolean(value))
    return parts.length > 0 ? parts.join(', ') : undefined
  }
}
