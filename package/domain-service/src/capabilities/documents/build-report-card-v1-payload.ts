import type {
  DocumentTeacher,
  ReportCardResult,
  ReportCardResultSection,
  School,
  Student,
} from '@edaya/core'
import { ReportCardDefinitionSectionKind } from '@edaya/core'
import {
  catalogBulletinSection,
  catalogClassName,
  catalogDocumentLabel,
  catalogLangFromLocale,
  catalogPeriodLabel,
  catalogSubjectName,
  catalogText,
} from './catalog-label'

export interface ReportCardDocumentContext {
  result: ReportCardResult
  student: Student
  school: School
  periodLabel: string
  classLabel?: string
  schoolYear?: string
  locale?: string
  /** Prefer subject catalog names over stored section labels (often IDs/codes). */
  subjectNameByClassSubjectId?: ReadonlyMap<string, string>
  /** Subject teachers keyed by class subject id. */
  teacherNameByClassSubjectId?: ReadonlyMap<string, string>
  teachersByClassSubjectId?: ReadonlyMap<string, readonly DocumentTeacher[]>
  classResults?: {
    classAverage?: string
    lowestAverage?: string
    highestAverage?: string
  }
  homeroomTeacherName?: string
  homeroomTeachers?: readonly DocumentTeacher[]
  principalName?: string
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
  teachers?: readonly DocumentTeacher[]
}

export interface ReportCardV1Payload {
  studentName: string
  periodLabel: string
  schoolName: string
  subjects: ReportCardV1SubjectRow[]
  schoolYear?: string
  classLabel?: string
  classSize?: string
  matricule?: string
  birthDate?: string
  birthPlace?: string
  nationality?: string
  gender?: string
  semesterAverage?: string
  semesterRank?: string
  schoolCity?: string
  attendance?: {
    absenceHoursTotal?: string
    absenceHoursJustified?: string
    absenceHoursUnjustified?: string
  }
  classResults?: {
    classAverage?: string
    lowestAverage?: string
    highestAverage?: string
  }
  council?: {
    appreciation?: string
    homeroomTeacherName?: string
    homeroomTeachers?: readonly DocumentTeacher[]
    principalName?: string
  }
}

function formatNumber(value: number | undefined, locale: string): string {
  if (value === undefined)
    return '—'
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value)
}

function formatRank(rank: number, classSize: number, locale: string): string {
  if (locale.toLowerCase().startsWith('en')) {
    return `${rank} / ${classSize}`
  }
  return `${rank}è / ${classSize}`
}

function formatSemesterRank(rank: number, classSize: number, locale: string): string {
  if (locale.toLowerCase().startsWith('en')) {
    return `${rank} / ${classSize} students`
  }
  return `${rank}è / ${classSize} élèves`
}

function isBilanName(name: string): boolean {
  return /bilan/i.test(name)
}

function resolveSectionName(
  section: ReportCardResultSection,
  lang: ReturnType<typeof catalogLangFromLocale>,
  subjectNameByClassSubjectId?: ReadonlyMap<string, string>,
): string {
  if (section.classSubjectId && subjectNameByClassSubjectId) {
    const resolved = subjectNameByClassSubjectId.get(section.classSubjectId)
    if (resolved) {
      return catalogSubjectName(resolved, lang)
    }
  }
  return catalogBulletinSection(catalogText(section.name, lang), lang)
}

function mapSubjectRow(
  section: ReportCardResultSection,
  kind: ReportCardV1SubjectRow['kind'],
  locale: string,
  classSize?: number,
  subjectNameByClassSubjectId?: ReadonlyMap<string, string>,
  teacherNameByClassSubjectId?: ReadonlyMap<string, string>,
  teachersByClassSubjectId?: ReadonlyMap<string, readonly DocumentTeacher[]>,
): ReportCardV1SubjectRow {
  const total = section.average === undefined ? undefined : section.average * section.weight
  const teacherName = section.classSubjectId
    ? teacherNameByClassSubjectId?.get(section.classSubjectId)
    : undefined
  return {
    name: resolveSectionName(section, catalogLangFromLocale(locale), subjectNameByClassSubjectId),
    kind,
    average: formatNumber(section.average, locale),
    coefficient: String(section.weight),
    total: formatNumber(total, locale),
    ...(section.rank !== undefined && classSize !== undefined
      ? { rank: formatRank(section.rank, classSize, locale) }
      : {}),
    ...(section.comment ? { appreciation: section.comment } : {}),
    ...(teacherName ? { teacherName } : {}),
    ...(kind === 'subject' && section.classSubjectId && teachersByClassSubjectId?.get(section.classSubjectId)?.length
      ? { teachers: teachersByClassSubjectId.get(section.classSubjectId) }
      : {}),
  }
}

function flattenSections(
  sections: readonly ReportCardResultSection[],
  locale: string,
  classSize?: number,
  subjectNameByClassSubjectId?: ReadonlyMap<string, string>,
  teacherNameByClassSubjectId?: ReadonlyMap<string, string>,
  teachersByClassSubjectId?: ReadonlyMap<string, readonly DocumentTeacher[]>,
): ReportCardV1SubjectRow[] {
  const rows: ReportCardV1SubjectRow[] = []

  for (const section of sections) {
    if (section.sectionKind === ReportCardDefinitionSectionKind.Subject) {
      rows.push(mapSubjectRow(
        section,
        'subject',
        locale,
        classSize,
        subjectNameByClassSubjectId,
        teacherNameByClassSubjectId,
        teachersByClassSubjectId,
      ))
      continue
    }

    for (const child of section.subResults) {
      if (child.sectionKind === ReportCardDefinitionSectionKind.Subject) {
        rows.push(mapSubjectRow(
          child,
          'subject',
          locale,
          classSize,
          subjectNameByClassSubjectId,
          teacherNameByClassSubjectId,
          teachersByClassSubjectId,
        ))
      }
    }

    if (isBilanName(section.name) || section.subResults.length > 0) {
      rows.push(mapSubjectRow(
        section,
        'bilan',
        locale,
        classSize,
        subjectNameByClassSubjectId,
        teacherNameByClassSubjectId,
        teachersByClassSubjectId,
      ))
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
  const lang = catalogLangFromLocale(locale)
  const subjects = flattenSections(
    input.result.sectionResults,
    locale,
    input.result.classSize,
    input.subjectNameByClassSubjectId,
    input.teacherNameByClassSubjectId,
    input.teachersByClassSubjectId,
  )

  if (subjects.length === 0) {
    throw new Error(`Report card ${input.result.id} has no section results to render`)
  }

  if (input.result.overallAverage !== undefined) {
    subjects.push({
      name: catalogDocumentLabel('TOTAL', lang),
      kind: 'totals',
      average: formatNumber(input.result.overallAverage, locale),
      ...(input.result.rank !== undefined && input.result.classSize !== undefined
        ? { rank: formatRank(input.result.rank, input.result.classSize, locale) }
        : {}),
    })
  }

  const attendance = input.result.attendanceSummary
  const appreciation = input.result.teacherComment ?? input.result.principalComment
  const payload: ReportCardV1Payload = {
    studentName: input.student.fullName,
    periodLabel: catalogPeriodLabel(input.periodLabel, lang),
    schoolName: input.school.name,
    subjects,
    ...(input.schoolYear ? { schoolYear: input.schoolYear } : {}),
    ...(input.classLabel ? { classLabel: catalogClassName(input.classLabel, lang) } : {}),
    ...(input.result.classSize !== undefined ? { classSize: String(input.result.classSize) } : {}),
    ...(input.student.matricule ? { matricule: input.student.matricule } : {}),
    ...(input.student.birthDate ? { birthDate: formatDate(input.student.birthDate, locale) } : {}),
    ...(input.student.placeOfBirth ? { birthPlace: input.student.placeOfBirth } : {}),
    ...(input.student.nationality ? { nationality: input.student.nationality } : {}),
    ...(input.student.gender ? { gender: input.student.gender } : {}),
    ...(input.result.overallAverage !== undefined
      ? {
          semesterAverage: `${formatNumber(input.result.overallAverage, locale)} / 20`,
        }
      : {}),
    ...(input.result.rank !== undefined && input.result.classSize !== undefined
      ? {
          semesterRank: formatSemesterRank(input.result.rank, input.result.classSize, locale),
        }
      : {}),
    ...(input.school.city ? { schoolCity: input.school.city } : {}),
    attendance: {
      absenceHoursTotal: String(attendance.absenceCount),
      absenceHoursJustified: String(attendance.excusedAbsenceCount),
      absenceHoursUnjustified: String(Math.max(0, attendance.absenceCount - attendance.excusedAbsenceCount)),
    },
    ...(input.classResults ? { classResults: input.classResults } : {}),
    ...(appreciation || input.homeroomTeacherName || input.homeroomTeachers?.length || input.principalName
      ? {
          council: {
            ...(appreciation ? { appreciation } : {}),
            ...(input.homeroomTeacherName ? { homeroomTeacherName: input.homeroomTeacherName } : {}),
            ...(input.homeroomTeachers?.length ? { homeroomTeachers: input.homeroomTeachers } : {}),
            ...(input.principalName ? { principalName: input.principalName } : {}),
          },
        }
      : {}),
  }

  return payload
}
