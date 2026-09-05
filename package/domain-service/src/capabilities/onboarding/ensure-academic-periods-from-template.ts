import type { ActorMetadata } from '@edaya/authorization'
import type { OnboardingSchoolApplication } from './onboarding-application'
import type {
  StructureTemplateDefinition,
  StructureTemplateReportCardPeriod,
  StructureTemplateReportCardStructure,
} from './structure-template-types'
import { randomUUID } from 'node:crypto'
import { AcademicPeriodType } from '@edaya/core'

export interface EnsureAcademicPeriodsInput {
  schoolId: string
  academicYearId: string
  academicYearStart: Date
  academicYearEnd: Date
  templates: readonly StructureTemplateDefinition[]
}

function summaryPeriodForStructure(
  structure: StructureTemplateReportCardStructure,
): StructureTemplateReportCardPeriod {
  return structure.summaryPeriod ?? {
    code: 'SYNTHESE',
    name: structure.periods.length > 2 ? 'Synthèse trimestrielle' : 'Synthèse semestrielle',
    weight: 1,
  }
}

export function collectTemplateReportCardPeriods(
  templates: readonly StructureTemplateDefinition[],
): StructureTemplateReportCardPeriod[] {
  const byCode = new Map<string, StructureTemplateReportCardPeriod>()

  for (const template of templates) {
    const structure = template.reportCardStructure
    if (!structure) {
      continue
    }
    for (const period of structure.periods) {
      byCode.set(period.code, period)
    }
    if (structure.includeSummary !== false) {
      const summary = summaryPeriodForStructure(structure)
      byCode.set(summary.code, summary)
    }
  }

  return [...byCode.values()]
}

function periodDateRanges(
  academicYearStart: Date,
  academicYearEnd: Date,
  periods: readonly StructureTemplateReportCardPeriod[],
): Array<{ period: StructureTemplateReportCardPeriod, startDate: Date, endDate: Date }> {
  const teachingPeriods = periods.filter(period => period.code !== 'SYNTHESE')
  const summaryPeriod = periods.find(period => period.code === 'SYNTHESE')
  const startMs = academicYearStart.getTime()
  const endMs = academicYearEnd.getTime()
  const spanMs = Math.max(endMs - startMs, 1)
  const sliceMs = Math.floor(spanMs / Math.max(teachingPeriods.length, 1))

  const ranges = teachingPeriods.map((period, index) => {
    const sliceStart = startMs + sliceMs * index
    const sliceEnd = index === teachingPeriods.length - 1
      ? endMs
      : startMs + sliceMs * (index + 1) - 1
    return {
      period,
      startDate: new Date(sliceStart),
      endDate: new Date(sliceEnd),
    }
  })

  if (summaryPeriod) {
    const lastTeachingEnd = ranges.at(-1)?.endDate ?? academicYearEnd
    ranges.push({
      period: summaryPeriod,
      startDate: lastTeachingEnd,
      endDate: academicYearEnd,
    })
  }

  return ranges
}

function periodType(teachingPeriodCount: number): AcademicPeriodType {
  if (teachingPeriodCount <= 2) {
    return AcademicPeriodType.Semester
  }
  return AcademicPeriodType.Trimester
}

export async function ensureAcademicPeriodsFromTemplates(
  application: OnboardingSchoolApplication,
  actor: ActorMetadata,
  input: EnsureAcademicPeriodsInput,
): Promise<Record<string, string>> {
  const service = application.forActor(actor)
  const periodDefinitions = collectTemplateReportCardPeriods(input.templates)
  if (periodDefinitions.length === 0) {
    return {}
  }

  const existing = await application.repositories.academicPeriods.list({
    schoolId: input.schoolId,
    academicYearId: input.academicYearId,
  })
  const periodIdsByCode: Record<string, string> = {}
  for (const period of existing) {
    const match = periodDefinitions.find(definition => definition.name === period.name)
    if (match) {
      periodIdsByCode[match.code] = period.id
    }
  }

  const ranges = periodDateRanges(
    input.academicYearStart,
    input.academicYearEnd,
    periodDefinitions,
  )
  const type = periodType(periodDefinitions.filter(period => period.code !== 'SYNTHESE').length)

  for (const { period, startDate, endDate } of ranges) {
    if (periodIdsByCode[period.code]) {
      continue
    }
    const periodId = randomUUID()
    await service.setupWorkflow.createAcademicPeriod({
      id: periodId,
      schoolId: input.schoolId,
      academicYearId: input.academicYearId,
      name: period.name,
      type,
      startDate,
      endDate,
    })
    periodIdsByCode[period.code] = periodId
  }

  return periodIdsByCode
}
