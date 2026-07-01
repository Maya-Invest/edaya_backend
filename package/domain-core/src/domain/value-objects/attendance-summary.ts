import { z } from 'zod'
import { parseDomain } from '../../domain/shared/utils'

export const attendanceSummaryBaseSchema = z.object({
  presentCount: z.number().int().nonnegative('presentCount must be a non-negative integer'),
  absenceCount: z.number().int().nonnegative('absenceCount must be a non-negative integer'),
  excusedAbsenceCount: z.number().int().nonnegative('excusedAbsenceCount must be a non-negative integer').default(0),
  lateCount: z.number().int().nonnegative('lateCount must be a non-negative integer'),
})

function refineAttendanceSummary(data: z.infer<typeof attendanceSummaryBaseSchema>, ctx: z.RefinementCtx) {
  if (data.excusedAbsenceCount > data.absenceCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'excusedAbsenceCount must not exceed absenceCount',
    })
  }
}

export const attendanceSummarySchema = attendanceSummaryBaseSchema.superRefine(refineAttendanceSummary)

export type AttendanceSummaryData = z.infer<typeof attendanceSummarySchema>
export type AttendanceSummaryInput = z.input<typeof attendanceSummarySchema>

/**
 * An aggregated summary of a student's attendance records over a specific period,
 * including total present, absent, and late counts, as well as an attendance rate.
 */
export class AttendanceSummary {
  readonly presentCount: number
  readonly absenceCount: number
  readonly excusedAbsenceCount: number
  readonly lateCount: number

  constructor(input: AttendanceSummaryInput) {
    const data = parseDomain(attendanceSummarySchema, input)
    this.presentCount = data.presentCount
    this.absenceCount = data.absenceCount
    this.excusedAbsenceCount = data.excusedAbsenceCount
    this.lateCount = data.lateCount
  }

  get total(): number {
    return this.presentCount + this.absenceCount + this.lateCount
  }

  get attendanceRate(): number {
    return this.total === 0 ? 0 : this.presentCount / this.total
  }
}
