import type { ActorMetadata } from '@edaya/authorization'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type { OnboardingDataset } from './onboarding-dataset'
import { randomUUID } from 'node:crypto'
import { AcademicPeriodType, BusinessRuleViolationError } from '@edaya/core'

type CalendarProfile = OnboardingDataset['calendarProfiles'][number]

export function resolveDatasetCalendar(profiles: readonly CalendarProfile[]): CalendarProfile {
  const first = profiles[0]
  if (!first)
    throw new BusinessRuleViolationError('STRUCTURE_CALENDAR_REQUIRED', 'Select a dataset calendar profile')
  const content = (row: CalendarProfile) => JSON.stringify({ type: row.periodType, periods: row.periods })
  if (profiles.some(profile => content(profile) !== content(first)))
    throw new BusinessRuleViolationError('STRUCTURE_CALENDAR_CONFLICT', 'Selected templates use incompatible calendar profiles')
  return first
}

/** Dataset calendars are a fallback only; an existing school calendar is authoritative. */
export async function ensureAcademicPeriodsFromDataset(application: OnboardingSchoolApplication, actor: ActorMetadata, input: {
  schoolId: string
  academicYearId: string
  academicYearStart: Date
  academicYearEnd: Date
  profiles: readonly CalendarProfile[]
}): Promise<void> {
  const existing = await application.repositories.academicPeriods.list({ schoolId: input.schoolId, academicYearId: input.academicYearId })
  if (existing.length)
    return
  const profile = resolveDatasetCalendar(input.profiles)
  const start = input.academicYearStart.getTime()
  const days = Math.floor((input.academicYearEnd.getTime() - start) / 86400000) + 1
  if (days < profile.periods.length)
    throw new BusinessRuleViolationError('STRUCTURE_CALENDAR_INVALID', 'Academic year is too short for the calendar profile')
  for (const [index, period] of profile.periods.entries()) {
    await application.forActor(actor).setupWorkflow.createAcademicPeriod({
      id: randomUUID(),
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name: period.name,
      type: profile.periodType === 'semester' ? AcademicPeriodType.Semester : AcademicPeriodType.Trimester,
      startDate: new Date(start + Math.floor(days * index / profile.periods.length) * 86400000),
      endDate: index === profile.periods.length - 1 ? input.academicYearEnd : new Date(start + (Math.floor(days * (index + 1) / profile.periods.length) - 1) * 86400000),
    })
  }
}
