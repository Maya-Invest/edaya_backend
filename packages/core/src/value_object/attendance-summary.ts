import { requireNonNegativeInt } from '../entities/utils'

export interface AttendanceSummaryArgs {
  presentCount: number
  absenceCount: number
  excusedAbsenceCount?: number
  lateCount: number
}

/**
 * An aggregated summary of a student's attendance records over a specific period,
 * including total present, absent, and late counts, as well as an attendance rate.
 */
export class AttendanceSummary {
  readonly presentCount: number
  readonly absenceCount: number
  readonly excusedAbsenceCount: number
  readonly lateCount: number

  constructor({ presentCount, absenceCount, excusedAbsenceCount = 0, lateCount }: AttendanceSummaryArgs) {
    this.presentCount = requireNonNegativeInt(presentCount, 'presentCount')
    this.absenceCount = requireNonNegativeInt(absenceCount, 'absenceCount')
    this.excusedAbsenceCount = requireNonNegativeInt(excusedAbsenceCount, 'excusedAbsenceCount')
    this.lateCount = requireNonNegativeInt(lateCount, 'lateCount')
    if (this.excusedAbsenceCount > this.absenceCount) {
      throw new Error('excusedAbsenceCount must not exceed absenceCount')
    }
  }

  get total(): number {
    return this.presentCount + this.absenceCount + this.lateCount
  }

  get attendanceRate(): number {
    return this.total === 0 ? 0 : this.presentCount / this.total
  }
}
