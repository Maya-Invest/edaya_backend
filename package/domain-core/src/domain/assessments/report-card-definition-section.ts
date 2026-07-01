import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports'
import { z } from 'zod'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { parseDomain, zodDate } from '../shared/utils'

export enum ReportCardDefinitionSectionKind {
  Group = 'group',
  Subject = 'subject',
}

export enum ReportCardDefinitionSectionRole {
  Subjects = 'matieres',
  Summary = 'synthese',
  Comments = 'appreciation',
}

export const reportCardDefinitionSectionBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  reportCardDefinitionId: z.string().trim().min(1, 'reportCardDefinitionId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  kind: z.nativeEnum(ReportCardDefinitionSectionKind).default(ReportCardDefinitionSectionKind.Group),
  role: z.nativeEnum(ReportCardDefinitionSectionRole).nullable().optional().transform(v => v === null ? undefined : v),
  coefficient: z.number().finite().positive('coefficient must be a finite, strictly positive number').nullable().optional().transform(v => v === null ? undefined : v),
  order: z.number().int().positive('order must be a strictly positive integer'),
  weight: z.number().finite().positive('weight must be a finite, strictly positive number'),
  parentSectionId: z.string().trim().min(1, 'parentSectionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

function refineReportCardDefinitionSection(data: any, ctx: z.RefinementCtx) {
  if (data.kind === ReportCardDefinitionSectionKind.Group && data.subjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'group report card sections must not reference a subject',
    })
  }
  if (data.kind === ReportCardDefinitionSectionKind.Subject && !data.subjectId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'subject report card sections must reference a subject',
    })
  }
}

export const reportCardDefinitionSectionSchema = reportCardDefinitionSectionBaseSchema.superRefine(refineReportCardDefinitionSection)

export type ReportCardDefinitionSectionData = z.infer<typeof reportCardDefinitionSectionSchema>
export type ReportCardDefinitionSectionInput = z.input<typeof reportCardDefinitionSectionSchema>

export const reportCardDefinitionSectionCreateSchema = reportCardDefinitionSectionBaseSchema.omit({ createdAt: true }).superRefine(refineReportCardDefinitionSection)
export const reportCardDefinitionSectionUpdateSchema = reportCardDefinitionSectionBaseSchema.partial().required({ id: true }).superRefine(refineReportCardDefinitionSection)

/**
 * Represents one section in a report-card definition.
 * Group sections organize child sections; subject sections reference a subject
 * that is resolved to the classGroup's ClassSubject during result generation.
 */
export class ReportCardDefinitionSection {
  readonly data: ReportCardDefinitionSectionData

  constructor(args: ReportCardDefinitionSectionInput) {
    this.data = parseDomain(reportCardDefinitionSectionSchema, args)
  }

  get id() { return this.data.id }
  get reportCardDefinitionId() { return this.data.reportCardDefinitionId }
  get kind() { return this.data.kind }
  get role() { return this.data.role }
  get coefficient() { return this.data.coefficient }
  get name() { return this.data.name }
  get order() { return this.data.order }
  get weight() { return this.data.weight }
  get parentSectionId() { return this.data.parentSectionId }
  get subjectId() { return this.data.subjectId }
  get createdAt() { return this.data.createdAt }

  copyWith({
    name,
    kind,
    order,
    weight,
    parentSectionId,
    subjectId,
  }: {
    name?: string
    kind?: ReportCardDefinitionSectionKind
    order?: number
    weight?: number
    parentSectionId?: string | null
    subjectId?: string | null
  }): ReportCardDefinitionSection {
    return new ReportCardDefinitionSection({
      id: this.id,
      reportCardDefinitionId: this.reportCardDefinitionId,
      name: name ?? this.name,
      kind: kind ?? this.kind,
      order: order ?? this.order,
      weight: weight ?? this.weight,
      parentSectionId: parentSectionId !== undefined ? parentSectionId : this.parentSectionId,
      subjectId: subjectId !== undefined ? subjectId : this.subjectId,
      createdAt: this.createdAt,
    })
  }
}

export const reportCardDefinitionSectionConfig: EntityConfigFactory<ReportCardDefinitionSection> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.sections,
    tenant: reportCardSectionTenant(),
    read: read(permissionAction(Permission.QUERY_REPORT_CARD_DETAIL_READ), noopReadAccess),
    write: write(permissionAction(Permission.EXAM_CONFIG_CONFIGURE), authorizeReportCardSection(policy), authorizeReportCardSectionDelete(policy)),
    gates: {
      preSave: validateReportCardSectionSave,
      preDelete: validateReportCardSectionDelete,
    },
    atomicExecution,
  })

function reportCardSectionTenant(): EntityTenantResolver<ReportCardDefinitionSection> {
  return indirectTenant(async (entity, repositories) => {
    const definition = await repositories.definitions.findById(entity.reportCardDefinitionId)
    return definition?.schoolId
  })
}

async function validateReportCardSectionSave(
  section: ReportCardDefinitionSection,
  _existing: ReportCardDefinitionSection | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  const definition = await repositories.definitions.findById(section.reportCardDefinitionId)
  if (!definition) {
    denyResourceAccess()
  }
  if (section.parentSectionId === section.id) {
    throw new BusinessRuleViolationError(
      'REPORT_CARD_SECTION_SELF_PARENT',
      'report card sections must not parent themselves',
    )
  }
  if (!section.parentSectionId)
    return

  const parent = await repositories.sections.findById(section.parentSectionId)
  if (!parent || parent.reportCardDefinitionId !== section.reportCardDefinitionId) {
    denyResourceAccess()
  }
  if (parent.kind !== ReportCardDefinitionSectionKind.Group) {
    throw new BusinessRuleViolationError(
      'SUBJECT_SECTION_HAS_CHILDREN',
      'subject report card sections must not contain child sections',
    )
  }
  await requireAcyclicSectionParent(section.id, parent, repositories)
}

export function authorizeReportCardSection(_policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardDefinitionSection>['authorizeSave'] {
  return noopSaveAccess
}

async function requireAcyclicSectionParent(
  sectionId: string,
  parent: ReportCardDefinitionSection,
  repositories: SchoolRepositories,
): Promise<void> {
  let candidate: ReportCardDefinitionSection | undefined = parent
  while (candidate) {
    if (candidate.id === sectionId) {
      throw new BusinessRuleViolationError(
        'REPORT_CARD_SECTION_CYCLE',
        'report card definition sections must not contain cycles',
      )
    }
    candidate = candidate.parentSectionId
      ? await repositories.sections.findById(candidate.parentSectionId)
      : undefined
  }
}

export function authorizeReportCardSectionDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ReportCardDefinitionSection>['authorizeDelete'] {
  return noopDeleteAccess
}

async function validateReportCardSectionDelete(
  section: ReportCardDefinitionSection,
  repositories: SchoolRepositories,
): Promise<void> {
  const children = await repositories.sections.list({ parentSectionId: section.id })
  if (children.length > 0) {
    throw new BusinessRuleViolationError('REPORT_CARD_SECTION_HAS_CHILDREN', `Cannot delete report card section ${section.id}: child sections still exist`)
  }
}
