import type { ActorMetadata } from '@edaya/authorization'
import type { OnboardingSchoolApplication } from './onboarding-application'
import { randomUUID } from 'node:crypto'
import { AcademicPeriodType, BusinessRuleViolationError } from '@edaya/core'

export interface EnsureAcademicStructureFromDraftInput {
  schoolId: string
  academicYearLabel: string
  academicYearStart: string
  academicYearEnd: string
  periodType: 'trimester' | 'semester'
  periods: Array<{ label: string, start: string, end: string }>
}

export interface EnsureAcademicStructureFromDraftResult {
  yearId: string
  periodId: string
  createdYear: boolean
  createdPeriodCount: number
}

function parseDateOnly(value: string): Date {
  const trimmed = value.trim()
  const date = new Date(`${trimmed}T00:00:00.000Z`)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== trimmed)
    throw new BusinessRuleViolationError('INVALID_ACADEMIC_DATE', `Invalid date: ${value}`)
  return date
}

export async function ensureAcademicStructureFromDraft(application: OnboardingSchoolApplication, actor: ActorMetadata, input: EnsureAcademicStructureFromDraftInput): Promise<EnsureAcademicStructureFromDraftResult> {
  const service = application.forActor(actor)
  const startDate = parseDateOnly(input.academicYearStart)
  const endDate = parseDateOnly(input.academicYearEnd)
  if (endDate < startDate)
    throw new BusinessRuleViolationError('INVALID_ACADEMIC_DATE', 'Academic year ends before it starts')
  if (!input.periods.length)
    throw new BusinessRuleViolationError('ACADEMIC_PERIOD_REQUIRED', 'At least one academic period is required')
  const definitions = input.periods.map(period => ({ name: period.label.trim(), startDate: parseDateOnly(period.start), endDate: parseDateOnly(period.end) }))
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  const names = new Set<string>()
  for (const [index, period] of definitions.entries()) {
    if (!period.name || names.has(period.name))
      throw new BusinessRuleViolationError('ACADEMIC_CALENDAR_INVALID', 'Period names must be nonempty and unique')
    names.add(period.name)
    if (period.startDate < startDate || period.endDate > endDate || period.endDate < period.startDate)
      throw new BusinessRuleViolationError('ACADEMIC_PERIOD_OUTSIDE_YEAR', 'Configured periods fall outside the academic year')
    if (index > 0 && definitions[index - 1]!.endDate >= period.startDate)
      throw new BusinessRuleViolationError('ACADEMIC_CALENDAR_INVALID', 'Academic periods must not overlap')
  }
  const years = await application.repositories.academicYears.list({ schoolId: input.schoolId })
  const matches = years.filter(year => year.name === input.academicYearLabel.trim())
  const existingYear = matches[0]
  if (matches.length > 1 || (existingYear && (existingYear.startDate.getTime() !== startDate.getTime() || existingYear.endDate.getTime() !== endDate.getTime())))
    throw new BusinessRuleViolationError('ACADEMIC_CALENDAR_CONFLICT', 'Existing academic year differs from the submitted calendar')
  const yearId = existingYear?.id ?? randomUUID()
  const type = input.periodType === 'semester' ? AcademicPeriodType.Semester : AcademicPeriodType.Trimester
  const existing = existingYear ? await application.repositories.academicPeriods.list({ schoolId: input.schoolId, academicYearId: yearId }) : []
  const ordered = [...existing].sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  if (ordered.length && (ordered.length !== definitions.length || ordered.some((period, i) => {
    const definition = definitions[i]!
    return period.name !== definition.name || period.type !== type || period.startDate.getTime() !== definition.startDate.getTime() || period.endDate.getTime() !== definition.endDate.getTime()
  }))) {
    throw new BusinessRuleViolationError('ACADEMIC_CALENDAR_CONFLICT', 'Existing periods differ from the submitted calendar')
  }

  if (!existingYear) {
    await service.setupWorkflow.createAcademicYear({ id: yearId, schoolId: input.schoolId, name: input.academicYearLabel.trim(), startDate, endDate })
    await service.setupWorkflow.publishAcademicYear({ academicYearId: yearId })
  }
  if (ordered.length) {
    for (const period of ordered) {
      if (!period.isPublished)
        await service.setupWorkflow.publishAcademicPeriod({ academicPeriodId: period.id })
    }
    return { yearId, periodId: ordered[0]!.id, createdYear: false, createdPeriodCount: 0 }
  }
  const ids: string[] = []
  for (const definition of definitions) {
    const id = randomUUID()
    await service.setupWorkflow.createAcademicPeriod({ id, schoolId: input.schoolId, academicYearId: yearId, ...definition, type, isPublished: false })
    await service.setupWorkflow.publishAcademicPeriod({ academicPeriodId: id })
    ids.push(id)
  }
  return { yearId, periodId: ids[0]!, createdYear: !existingYear, createdPeriodCount: ids.length }
}
