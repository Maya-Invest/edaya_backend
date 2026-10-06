import type { OccupiedInterval, ResolvedTimetableCell } from './types'

const UTC_DAY_MS = 86_400_000

/** Half-open intervals are indexed in every UTC day they overlap. */
export class TimetableOccupancyIndex {
  private readonly resources = new Map<string, Map<number, OccupiedInterval[]>>()

  constructor(intervals: readonly OccupiedInterval[] = [], private readonly parent?: TimetableOccupancyIndex) {
    this.add(intervals)
  }

  add(intervals: readonly OccupiedInterval[]): void {
    for (const interval of intervals) {
      const key = `${interval.layer}:${interval.layerKey}`
      const days = this.resources.get(key) ?? new Map<number, OccupiedInterval[]>()
      const first = Math.floor(interval.startsAt.getTime() / UTC_DAY_MS)
      const last = Math.floor((interval.endsAt.getTime() - 1) / UTC_DAY_MS)
      for (let day = first; day <= last; day++) {
        const entries = days.get(day) ?? []
        entries.push(interval)
        days.set(day, entries)
      }
      this.resources.set(key, days)
    }
  }

  /** Tentative lookahead writes never modify the parent index. */
  fork(intervals: readonly OccupiedInterval[] = []): TimetableOccupancyIndex {
    return new TimetableOccupancyIndex(intervals, this)
  }

  isAvailable(cell: ResolvedTimetableCell, classGroupId: string, teacherIds: readonly string[]): boolean {
    if (this.parent && !this.parent.isAvailable(cell, classGroupId, teacherIds))
      return false
    const startsAt = cell.startsAt.getTime()
    const endsAt = cell.endsAt.getTime()
    const first = Math.floor(startsAt / UTC_DAY_MS)
    const last = Math.floor((endsAt - 1) / UTC_DAY_MS)
    const keys = [`class_group:${classGroupId}`, ...teacherIds.map(id => `teacher:${id}`)]
    for (const key of keys) {
      const days = this.resources.get(key)
      if (!days)
        continue
      for (let day = first; day <= last; day++) {
        if (days.get(day)?.some(interval => startsAt < interval.endsAt.getTime() && interval.startsAt.getTime() < endsAt))
          return false
      }
    }
    return true
  }
}
