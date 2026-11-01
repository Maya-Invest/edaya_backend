import { AcademicPeriod, AcademicPeriodType, AcademicYear, CalendarEvent, CalendarEventKind, CalendarEventScopeKind } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { createAcademicTestApp } from './academic-test-app'

const dates = { startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30') }

describe('academic calendar mutations', () => {
  test('allows name-only edits of a legacy overlapping calendar without changing its dates', async () => {
    const { app, schoolRepositories: repos } = await createAcademicTestApp()
    const legacy = new AcademicPeriod({ id: 'legacy', schoolId: 'school', academicYearId: 'year-1', name: 'Legacy', startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31T23:59:59Z') })
    await repos.academicPeriods.save(legacy)
    await app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...legacy.data, name: 'Renamed', endDate: new Date('2026-12-31') }))
    expect((await repos.academicPeriods.findById(legacy.id))?.name).toBe('Renamed')
  })

  test('adds, updates, publishes and edits published periods without changing publication', async () => {
    const { app, schoolRepositories: repos } = await createAcademicTestApp()
    const period = new AcademicPeriod({ id: 'term-2', schoolId: 'school', academicYearId: 'year-1', name: 'Term 2', type: AcademicPeriodType.Trimester, ...dates })
    await app.baseService.entities.academicPeriods.save(period)
    await app.setupWorkflow.publishAcademicPeriod({ academicPeriodId: period.id })
    const published = (await repos.academicPeriods.findById(period.id))!
    await app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...published.data, startDate: new Date('2026-04-02'), endDate: new Date('2026-07-01') }))
    expect((await repos.academicPeriods.findById(period.id))?.isPublished).toBe(true)
    expect((await repos.academicPeriods.findById(period.id))?.endDate.toISOString()).toBe('2026-07-01T00:00:00.000Z')
  })

  test('rejects inclusive overlap and bounds violations, leaving stored data unchanged', async () => {
    const { app, schoolRepositories: repos } = await createAcademicTestApp()
    const period = new AcademicPeriod({ id: 'term-2', schoolId: 'school', academicYearId: 'year-1', name: 'Term 2', ...dates })
    await app.baseService.entities.academicPeriods.save(period)
    await expect(app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...period.data, startDate: new Date('2026-03-31') }))).rejects.toMatchObject({ code: 'ACADEMIC_PERIOD_OVERLAP' })
    await expect(app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...period.data, startDate: new Date('2026-03-31T12:00:00Z') }))).rejects.toMatchObject({ code: 'ACADEMIC_PERIOD_OVERLAP' })
    await expect(app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...period.data, endDate: new Date('2027-01-01') }))).rejects.toMatchObject({ code: 'ACADEMIC_PERIOD_OUTSIDE_YEAR' })
    expect((await repos.academicPeriods.findById(period.id))?.startDate).toEqual(dates.startDate)
    const year = (await repos.academicYears.findById('year-1'))!
    await expect(app.baseService.entities.academicYears.save(new AcademicYear({ ...year.data, endDate: new Date('2026-05-01') }))).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_EXCLUDES_PERIODS' })
  })

  test('archived calendars reject edits, additions, publication and deletion', async () => {
    const { app, schoolRepositories: repos } = await createAcademicTestApp()
    const draft = new AcademicPeriod({ id: 'term-2', schoolId: 'school', academicYearId: 'year-1', name: 'Term 2', ...dates })
    await app.baseService.entities.academicPeriods.save(draft)
    await app.setupWorkflow.archiveAcademicYear({ academicYearId: 'year-1' })
    const year = (await repos.academicYears.findById('year-1'))!
    await expect(app.baseService.entities.academicYears.save(new AcademicYear({ ...year.data, name: 'Changed' }))).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_ARCHIVED' })
    await expect(app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...draft.data, name: 'Changed' }))).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_ARCHIVED' })
    await expect(app.baseService.entities.academicPeriods.save(new AcademicPeriod({ ...draft.data, id: 'new' }))).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_ARCHIVED' })
    await expect(app.setupWorkflow.publishAcademicPeriod({ academicPeriodId: draft.id })).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_ARCHIVED' })
    await expect(app.baseService.entities.academicPeriods.delete(draft.id)).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_ARCHIVED' })
    await expect(app.baseService.entities.academicYears.delete(year.id)).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_NOT_DRAFT' })
  })

  test('deletes unused drafts only, without cascading child periods or calendar events', async () => {
    const { app, schoolRepositories: repos } = await createAcademicTestApp()
    const year = new AcademicYear({ id: 'draft-year', schoolId: 'school', name: 'Draft', startDate: new Date('2027-01-01'), endDate: new Date('2027-12-31') })
    await app.baseService.entities.academicYears.save(year)
    const period = new AcademicPeriod({ id: 'draft-period', schoolId: 'school', academicYearId: year.id, name: 'Draft period', startDate: year.startDate, endDate: year.endDate })
    await app.baseService.entities.academicPeriods.save(period)
    await expect(app.baseService.entities.academicYears.delete(year.id)).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_HAS_DEPENDENCIES' })
    expect(await repos.academicPeriods.findById(period.id)).toBeDefined()
    await app.baseService.entities.academicPeriods.delete(period.id)
    await repos.calendarEvents.save(new CalendarEvent({ id: 'event', schoolId: 'school', academicYearId: year.id, title: 'Holiday', kind: CalendarEventKind.Holiday, scopeKind: CalendarEventScopeKind.School, startDate: year.startDate, endDate: year.startDate }))
    await expect(app.baseService.entities.academicYears.delete(year.id)).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_HAS_DEPENDENCIES' })
    await repos.calendarEvents.delete('event')
    await app.baseService.entities.academicYears.delete(year.id)
    expect(await repos.academicYears.findById(year.id)).toBeUndefined()
    await expect(app.baseService.entities.academicPeriods.delete('period-1')).rejects.toMatchObject({ code: 'ACADEMIC_PERIOD_NOT_DRAFT' })
    await expect(app.baseService.entities.academicYears.delete('year-1')).rejects.toMatchObject({ code: 'ACADEMIC_YEAR_NOT_DRAFT' })
  })
})
