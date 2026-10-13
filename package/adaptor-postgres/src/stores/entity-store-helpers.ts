import type { ReportCardDefinitionSectionKind, ReportCardResultSection } from '@edaya/core'
import { ReportCardResultSection as ReportCardResultSectionCtor } from '@edaya/core'

export interface StoredReportCardResultSection {
  sectionId: string
  sectionKind: ReportCardDefinitionSectionKind
  name: string
  grading?: import('@edaya/core').CalculatedGrade
  rank?: number
  average: number
  weight: number
  parentSectionId?: string | null
  classSubjectId?: string | null
  comment?: string | null
  subResults?: StoredReportCardResultSection[]
  data?: StoredReportCardResultSection
}

export function enumValue<const T extends Record<string, string>>(
  values: T,
  value: unknown,
  fieldName: string,
): T[keyof T] {
  const allowedValues = Object.values(values)
  if (typeof value === 'string' && allowedValues.includes(value as T[keyof T])) {
    return value as T[keyof T]
  }
  throw new Error(`Invalid ${fieldName}: ${String(value)}`)
}

export function serializeReportCardResultSection(section: ReportCardResultSection): StoredReportCardResultSection {
  return {
    sectionId: section.sectionId,
    sectionKind: section.sectionKind,
    name: section.name,
    average: section.average,
    grading: section.grading,
    rank: section.rank,
    weight: section.weight,
    parentSectionId: section.parentSectionId ?? null,
    classSubjectId: section.classSubjectId ?? null,
    comment: section.comment ?? null,
    subResults: section.subResults.map(serializeReportCardResultSection),
  }
}

function unwrapReportCardResultSection(raw: StoredReportCardResultSection): StoredReportCardResultSection {
  if (raw.data?.sectionId) {
    return {
      ...raw.data,
      subResults: raw.subResults ?? raw.data.subResults ?? [],
    }
  }
  return raw
}

export function deserializeReportCardResultSection(raw: StoredReportCardResultSection): ReportCardResultSection {
  const section = unwrapReportCardResultSection(raw)
  return new ReportCardResultSectionCtor({
    sectionId: section.sectionId,
    sectionKind: section.sectionKind,
    name: section.name,
    average: section.average,
    grading: section.grading,
    rank: section.rank,
    weight: section.weight,
    parentSectionId: section.parentSectionId ?? undefined,
    classSubjectId: section.classSubjectId ?? undefined,
    comment: section.comment ?? undefined,
    subResults: (section.subResults ?? []).map(deserializeReportCardResultSection),
  })
}
