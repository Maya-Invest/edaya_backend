import { describe, expect, test } from 'bun:test'
import {
  generateTimetablePreview,
  renderTimetablePreview,
  timetablePreviewClosures,
  timetablePreviewFixture,
  timetablePreviewWeekPatterns,
} from '../../support/timetable-preview-fixture'

describe('timetable generation preview fixture', () => {
  test('generates the expected readable weekly timetable', () => {
    const previewResult = generateTimetablePreview()
    const weekPatterns = timetablePreviewWeekPatterns(previewResult)
    const placements = previewResult.classes.flatMap(classResult => classResult.result.placements)
    const teacherSlots = placements.flatMap(placement => placement.teacherIds.map(teacherId =>
      `${teacherId}:${placement.cell.startsAt.toISOString()}`,
    ))

    expect(previewResult.classes).toHaveLength(3)
    expect(weekPatterns).toHaveLength(13)
    expect(new Set(weekPatterns).size).toBeGreaterThan(1)
    expect(weekPatterns.filter(pattern => pattern === '')).toHaveLength(1)
    expect(placements).toHaveLength(252)
    expect(new Set(teacherSlots)).toHaveLength(teacherSlots.length)
    expect(previewResult.classes.flatMap(classResult => classResult.result.unmetWorkloads)).toEqual([])
    expect(timetablePreviewClosures).toHaveLength(2)
    expect(timetablePreviewFixture.cells.some(cell => cell.date === '2026-10-12')).toBe(false)
    expect(timetablePreviewFixture.cells.some(cell => cell.date === '2026-11-04')).toBe(false)
    const preview = renderTimetablePreview(previewResult)
    expect(preview.match(/^## Week \d+ of 13:/gm)).toHaveLength(13)
    expect(preview.match(/^### Grade 6 [ABC]$/gm)).toHaveLength(39)
    expect(preview).toContain('## Week 1 of 13: 2026-09-07 to 2026-09-11')
    expect(preview).toContain('## Week 13 of 13: 2026-11-30 to 2026-12-04')
    expect(preview).toContain('[Day off: Autumn vacation]')
    expect(preview).toMatchSnapshot()
  })
})
