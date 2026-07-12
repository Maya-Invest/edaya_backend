import type { PeriodDefinition } from '@edaya/core'
import type { TimetableGenerationMode } from '@edaya/core'

export interface ResolveTimetableSpaceInput {
  classGroupId: string
  academicYearId: string
  startDate: Date
  endDate: Date
}

export interface ResolvedTimetableCell {
  date: string
  weekKey: string
  weeklyIndex: number
  periodDefinitionId: string
  startsAt: Date
  endsAt: Date
}

export interface TimetableGenerationDefaults {
  generationMode: TimetableGenerationMode
  enforceWorkloadFulfillment: boolean
  excludeBreakSlots: boolean
  minDayGapSameSubject: number
  preferredPeriodDefinitionIds: string[]
  allowUnassignedTeacherPlacements: boolean
  useHomeroomTeacherFallback: boolean
  defaultMinPeriodSpan: number
  defaultMaxPeriodSpan: number
}

export interface TimetableSubjectDemand {
  classSubjectId: string
  displayLabel: string
  periodsPerWeek: number
  minPeriodSpan: number
  maxPeriodSpan: number
  teacherIds: string[]
}

export interface OccupiedInterval {
  layer: 'teacher' | 'class_group'
  layerKey: string
  startsAt: Date
  endsAt: Date
  sourceSessionId?: string
}

export interface OccupiedCell {
  date: string
  periodDefinitionId: string
  layer: 'teacher' | 'class_group'
  layerKey: string
  sourceSessionId?: string
}

export interface TimetablePlacement {
  classSubjectId: string
  displayLabel: string
  teacherIds: string[]
  cell: ResolvedTimetableCell
  span: number
  cells: readonly ResolvedTimetableCell[]
}

export interface UnmetTimetableWorkload {
  classSubjectId: string
  weekKey: string
  required: number
  placed: number
}

export interface SolveTimetableInput {
  classGroupId: string
  cells: ResolvedTimetableCell[]
  subjects: TimetableSubjectDemand[]
  occupiedIntervals: OccupiedInterval[]
  existingWorkloadByClassSubjectAndWeek?: Record<string, Record<string, number>>
  options: TimetableGenerationDefaults
}

export interface SolveTimetableResult {
  placements: TimetablePlacement[]
  unmetWorkloads: UnmetTimetableWorkload[]
}

export interface SpreadWeeklyTemplateInput {
  classGroupId: string
  templatePlacements: readonly TimetablePlacement[]
  periodById: ReadonlyMap<string, PeriodDefinition>
  startDate: Date
  endDate: Date
  nonSchoolDates: ReadonlySet<string>
  occupiedIntervals: readonly OccupiedInterval[]
  subjects: readonly TimetableSubjectDemand[]
  options: TimetableGenerationDefaults
}

export const WEEKLY_TEMPLATE_WEEK_KEY = '__template__'
