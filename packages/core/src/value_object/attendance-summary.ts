import { requireNonNegativeInt } from '$lib/core/validation'

export interface AttendanceSummaryArgs {
  presentCount: number
  absenceCount: number
  lateCount: number
}

/**
 * An aggregated summary of a student's attendance records over a specific period,
 * including total present, absent, and late counts, as well as an attendance rate.
 */
export class AttendanceSummary {
  readonly presentCount: number
  readonly absenceCount: number
  readonly lateCount: number

  constructor({ presentCount, absenceCount, lateCount }: AttendanceSummaryArgs) {
    this.presentCount = requireNonNegativeInt(presentCount, 'presentCount')
    this.absenceCount = requireNonNegativeInt(absenceCount, 'absenceCount')
    this.lateCount = requireNonNegativeInt(lateCount, 'lateCount')
  }

  get total(): number {
    return this.presentCount + this.absenceCount + this.lateCount
  }

  get attendanceRate(): number {
    return this.total === 0 ? 0 : this.presentCount / this.total
  }
}
