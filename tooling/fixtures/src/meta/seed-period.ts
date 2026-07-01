import { parseSeedDate } from './dates'

export function seedPeriodIdForDate(isoDate: string): string {
  const date = parseSeedDate(isoDate)
  if (date <= parseSeedDate('2025-12-19')) {
    return '2025-t1'
  }
  if (date <= parseSeedDate('2026-04-03')) {
    return '2025-t2'
  }
  return '2025-t3'
}
