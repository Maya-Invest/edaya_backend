import type { OccupiedInterval, ResolvedTimetableCell } from '../../../src/capabilities/timetable'
import { describe, expect, test } from 'bun:test'
import { TimetableOccupancyIndex } from '../../../src/capabilities/timetable/occupancy-index'

const at = (hours: number) => new Date(Date.UTC(2026, 8, 7, hours))
const cell = (start: number, end: number) => ({ startsAt: at(start), endsAt: at(end) }) as ResolvedTimetableCell

describe('indexed timetable occupancy', () => {
  test('blocks all days of cross-midnight intervals and respects adjacent half-open endpoints', () => {
    const index = new TimetableOccupancyIndex([{ layer: 'teacher', layerKey: 'teacher', startsAt: at(23), endsAt: at(26) }])
    expect(index.isAvailable(cell(24, 25), 'class', ['teacher'])).toBe(false)
    expect(index.isAvailable(cell(22, 23), 'class', ['teacher'])).toBe(true)
    expect(index.isAvailable(cell(26, 27), 'class', ['teacher'])).toBe(true)
    expect(index.isAvailable(cell(24, 25), 'class', ['other'])).toBe(true)
  })

  test('lookahead overlays cannot occupy the committed index or sibling searches', () => {
    const parent = new TimetableOccupancyIndex()
    const search = parent.fork([{ layer: 'class_group', layerKey: 'class', startsAt: at(8), endsAt: at(9) }])
    search.add([{ layer: 'teacher', layerKey: 'teacher', startsAt: at(9), endsAt: at(10) }])
    expect(search.isAvailable(cell(8, 9), 'class', [])).toBe(false)
    expect(parent.isAvailable(cell(8, 9), 'class', [])).toBe(true)
    expect(parent.fork().isAvailable(cell(9, 10), 'class', ['teacher'])).toBe(true)
    parent.add([{ layer: 'teacher', layerKey: 'teacher', startsAt: at(10), endsAt: at(11) }])
    expect(search.isAvailable(cell(10, 11), 'class', ['teacher'])).toBe(false)
  })

  test('matches exhaustive overlap checks over unrelated resources and long intervals', () => {
    const intervals: OccupiedInterval[] = Array.from({ length: 200 }, (_, i) => ({ layer: i % 2 ? 'teacher' : 'class_group', layerKey: `resource-${i % 7}`, startsAt: at(i - 48), endsAt: at(i - 47 + i % 50) }))
    const index = new TimetableOccupancyIndex(intervals)
    for (let hour = -50; hour < 240; hour += 3) {
      for (let resource = 0; resource < 9; resource++) {
        const target = cell(hour, hour + 27)
        const id = `resource-${resource}`
        const expected = !intervals.some(interval => interval.layerKey === id && target.startsAt < interval.endsAt && interval.startsAt < target.endsAt)
        expect(index.isAvailable(target, id, [id])).toBe(expected)
      }
    }
  })
})
