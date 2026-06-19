/* eslint-disable dot-notation -- process.env index signature requires bracket access for tsc */
import process from 'node:process'

/** Narrative "today" for dev fixtures — dashboard KPIs and rolling windows anchor here. */
export const SEED_REFERENCE_DATE = '2026-06-16'

/** Reference date when deriving fee status during dev finance seed. */
export const SEED_FINANCE_REFERENCE_DATE = SEED_REFERENCE_DATE

/** Default academic period when viewing the executive dashboard in dev. */
export const SEED_DASHBOARD_ACADEMIC_PERIOD_ID = '2025-t3'

export function parseSeedDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`)
}

export function parseSeedDateTime(isoDate: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const date = parseSeedDate(isoDate)
  date.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0)
  return date
}

/** Returns an ISO date offset by `days` from `fromDate` (defaults to `SEED_REFERENCE_DATE`). */
export function seedDateOffset(days: number, fromDate: string = SEED_REFERENCE_DATE): string {
  const date = parseSeedDate(fromDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Date within the dashboard upcoming window [referenceDate, referenceDate + 6 days]. */
export function seedUpcomingDate(offsetDays: number): string {
  if (offsetDays < 0 || offsetDays > 6) {
    throw new RangeError(`seedUpcomingDate offset must be 0..6, got ${offsetDays}`)
  }
  return seedDateOffset(offsetDays)
}

/** Resolves the narrative reference date, allowing runtime override via env. */
export function resolveSeedReferenceDate(): string {
  const override = process.env['SEED_REFERENCE_DATE']?.trim()
  return override || SEED_REFERENCE_DATE
}
