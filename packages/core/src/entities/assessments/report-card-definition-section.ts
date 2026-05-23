import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '$lib/core/utils/validation'

export enum ReportCardDefinitionSectionKind {
  Group = 'group',
  Subject = 'subject',
}

export interface ReportCardDefinitionSectionArgs {
  id: string
  reportCardDefinitionId: string
  name: string
  kind?: ReportCardDefinitionSectionKind
  weight: number
  parentSectionId?: string | null
  subjectId?: string | null
  createdAt?: Date
}

/**
 * Represents one section in a report-card definition.
 * Group sections organize child sections; subject sections reference a subject
 * that is resolved to the classGroup's ClassSubject during result generation.
 */
export class ReportCardDefinitionSection {
  readonly id: string
  readonly reportCardDefinitionId: string
  readonly kind: ReportCardDefinitionSectionKind
  readonly name: string
  readonly weight: number
  readonly parentSectionId?: string
  readonly subjectId?: string
  readonly createdAt: Date

  constructor({
    id,
    reportCardDefinitionId,
    name,
    kind = ReportCardDefinitionSectionKind.Group,
    weight,
    parentSectionId,
    subjectId,
    createdAt,
  }: ReportCardDefinitionSectionArgs) {
    this.id = requireNonBlank(id, 'id')
    this.reportCardDefinitionId = requireNonBlank(reportCardDefinitionId, 'reportCardDefinitionId')
    this.kind = kind
    this.name = requireNonBlank(name, 'name')
    this.weight = requirePositiveNumber(weight, 'weight')
    this.parentSectionId = requireOptionalNonBlank(parentSectionId, 'parentSectionId')
    this.subjectId = requireOptionalNonBlank(subjectId, 'subjectId')
    this.createdAt = createdAt ?? new Date()

    if (this.kind === ReportCardDefinitionSectionKind.Group && this.subjectId) {
      throw new Error('group report card sections must not reference a subject')
    }
    if (this.kind === ReportCardDefinitionSectionKind.Subject && !this.subjectId) {
      throw new Error('subject report card sections must reference a subject')
    }
  }

  copyWith({
    name,
    kind,
    weight,
    parentSectionId,
    subjectId,
  }: {
    name?: string
    kind?: ReportCardDefinitionSectionKind
    weight?: number
    parentSectionId?: string | null
    subjectId?: string | null
  }): ReportCardDefinitionSection {
    return new ReportCardDefinitionSection({
      id: this.id,
      reportCardDefinitionId: this.reportCardDefinitionId,
      name: name ?? this.name,
      kind: kind ?? this.kind,
      weight: weight ?? this.weight,
      parentSectionId: parentSectionId !== undefined ? parentSectionId : this.parentSectionId,
      subjectId: subjectId !== undefined ? subjectId : this.subjectId,
      createdAt: this.createdAt,
    })
  }
}
