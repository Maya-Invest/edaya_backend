import type {
  ReportCardResult,
  ReportCardResultSection,
  School,
  Student,
} from '@edaya/core'
import { ReportCardDefinitionSectionKind } from '@edaya/core'

export interface ReportCardDocumentContext {
  result: ReportCardResult
  student: Student
  school: School
  periodLabel: string
  classLabel?: string
  schoolYear?: string
  locale?: string
}

export interface ReportCardV1SubjectRow {
  name: string
  kind: 'subject' | 'bilan' | 'totals'
  average?: string
  coefficient?: string
  total?: string
  rank?: string
  appreciation?: string
  teacherName?: string
}

export interface ReportCardV1Payload {
  studentName: string
  periodLabel: string
  schoolName: string
  subjects: ReportCardV1SubjectRow[]
  schoolYear?: string
  classLabel?: string
  classSize?: string
  semesterAverage?: string
  semesterRank?: string
  schoolCity?: string
  attendance?: {
    absenceHoursTotal?: string
    absenceHoursJustified?: string
    absenceHoursUnjustified?: string
  }
  council?: {
    appreciation?: string
    homeroomTeacherName?: string
    principalName?: string
  }
}

function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function isBilanName(name: string): boolean {
  return /bilan/i.test(name)
}

function mapSubjectRow(
  section: ReportCardResultSection,
  kind: ReportCardV1SubjectRow['kind'],
  locale: string,
): ReportCardV1SubjectRow {
  const total = section.average * section.weight
  return {
    name: section.name,
    kind,
    average: formatNumber(section.average, locale),
    coefficient: String(section.weight),
    total: formatNumber(total, locale),
    ...(section.comment ? { appreciation: section.comment } : {}),
  }
}

function flattenSections(
  sections: readonly ReportCardResultSection[],
  locale: string,
): ReportCardV1SubjectRow[] {
  const rows: ReportCardV1SubjectRow[] = []

  for (const section of sections) {
    if (section.sectionKind === ReportCardDefinitionSectionKind.Subject) {
      rows.push(mapSubjectRow(section, 'subject', locale))
      continue
    }

    for (const child of section.subResults) {
      if (child.sectionKind === ReportCardDefinitionSectionKind.Subject) {
        rows.push(mapSubjectRow(child, 'subject', locale))
      }
    }

    if (isBilanName(section.name) || section.subResults.length > 0) {
      rows.push(mapSubjectRow(section, 'bilan', locale))
    }
  }

  return rows
}

/**
 * Maps a published school report-card result into a `report-card.v1` docs payload.
 * Caller supplies locale-formatted display strings only — docs does not compute grades.
 */
export function buildReportCardV1Payload(input: ReportCardDocumentContext): ReportCardV1Payload {
  const locale = input.locale ?? 'fr-FR'
  const subjects = flattenSections(input.result.sectionResults, locale)

  if (subjects.length === 0) {
    throw new Error(`Report card ${input.result.id} has no section results to render`)
  }

  if (input.result.overallAverage !== undefined) {
    subjects.push({
      name: 'TOTAL',
      kind: 'totals',
      average: formatNumber(input.result.overallAverage, locale),
      ...(input.result.rank !== undefined && input.result.classSize !== undefined
        ? { rank: `${input.result.rank}è / ${input.result.classSize}` }
        : {}),
    })
  }

  const attendance = input.result.attendanceSummary
  const payload: ReportCardV1Payload = {
    studentName: input.student.fullName,
    periodLabel: input.periodLabel,
    schoolName: input.school.name,
    subjects,
    ...(input.schoolYear ? { schoolYear: input.schoolYear } : {}),
    ...(input.classLabel ? { classLabel: input.classLabel } : {}),
    ...(input.result.classSize !== undefined ? { classSize: String(input.result.classSize) } : {}),
    ...(input.result.overallAverage !== undefined
      ? {
          semesterAverage: `${formatNumber(input.result.overallAverage, locale)} / 20`,
        }
      : {}),
    ...(input.result.rank !== undefined && input.result.classSize !== undefined
      ? {
          semesterRank: `${input.result.rank}è / ${input.result.classSize} élèves`,
        }
      : {}),
    ...(input.school.city ? { schoolCity: input.school.city } : {}),
    attendance: {
      absenceHoursTotal: String(attendance.absenceCount),
      absenceHoursJustified: String(attendance.excusedAbsenceCount),
      absenceHoursUnjustified: String(Math.max(0, attendance.absenceCount - attendance.excusedAbsenceCount)),
    },
    ...(input.result.teacherComment || input.result.principalComment
      ? {
          council: {
            ...(input.result.teacherComment ? { appreciation: input.result.teacherComment } : {}),
            ...(input.result.principalComment && !input.result.teacherComment
              ? { appreciation: input.result.principalComment }
              : {}),
          },
        }
      : {}),
  }

  return payload
}
