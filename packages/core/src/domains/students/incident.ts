import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { AuthorizationError, AuthorizationErrorCode, Permission } from '../../authorization'
import { AttachmentOwnerKind } from '../../domains'
import { config, dateTime, directSchoolTenant, noopReadAccess, permissionAction, read, write } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireNonBlank, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum IncidentKind {
  Positive = 'positive',
  MinorInfraction = 'minor_infraction',
  MajorInfraction = 'major_infraction',
  Emergency = 'emergency',
}

export enum IncidentStatus {
  Open = 'open',
  Resolved = 'resolved',
  Cancelled = 'cancelled',
}

export interface IncidentArgs {
  id: string
  schoolId: string
  title: string
  description: string
  date: Date
  kind: IncidentKind
  reporterId: string
  classGroupId?: string | null
  sessionId?: string | null
  status?: IncidentStatus
  resolutionNotes?: string | null
  resolvedAt?: Date | null
  resolvedByStaffId?: string | null
  createdAt?: Date
  updatedAt?: Date
}

/**
 * Represents a logged behavior event, which can be positive (merit/award)
 * or negative (infraction/emergency).
 */
export class Incident {
  readonly id: string
  readonly schoolId: string
  readonly title: string
  readonly description: string
  readonly date: Date
  readonly kind: IncidentKind
  readonly reporterId: string
  readonly classGroupId?: string
  readonly sessionId?: string
  readonly status: IncidentStatus
  readonly resolutionNotes?: string
  readonly resolvedAt?: Date
  readonly resolvedByStaffId?: string
  readonly createdAt: Date
  readonly updatedAt: Date

  constructor({
    id,
    schoolId,
    title,
    description,
    date,
    kind,
    reporterId,
    classGroupId,
    sessionId,
    status = IncidentStatus.Open,
    resolutionNotes,
    resolvedAt,
    resolvedByStaffId,
    createdAt,
    updatedAt,
  }: IncidentArgs) {
    this.id = requireNonBlank(id, 'id')
    this.schoolId = requireNonBlank(schoolId, 'schoolId')
    this.title = requireNonBlank(title, 'title')
    this.description = requireNonBlank(description, 'description')
    this.date = requireValidDate(date, 'date')
    this.kind = kind
    this.reporterId = requireNonBlank(reporterId, 'reporterId')
    this.classGroupId = requireOptionalNonBlank(classGroupId, 'classGroupId')
    this.sessionId = requireOptionalNonBlank(sessionId, 'sessionId')
    this.status = status
    this.resolutionNotes = requireOptionalNonBlank(resolutionNotes, 'resolutionNotes')
    this.resolvedAt = resolvedAt ? requireValidDate(resolvedAt, 'resolvedAt') : undefined
    this.resolvedByStaffId = requireOptionalNonBlank(resolvedByStaffId, 'resolvedByStaffId')
    const now = new Date()
    this.createdAt = createdAt ?? now
    this.updatedAt = updatedAt ?? now

    if ((this.resolvedAt && !this.resolvedByStaffId) || (!this.resolvedAt && this.resolvedByStaffId)) {
      throw new Error('resolvedAt and resolvedByStaffId must be provided together')
    }
    if (this.status === IncidentStatus.Resolved && !this.resolvedAt) {
      throw new Error('resolvedAt is required for resolved incidents')
    }
    if (this.status === IncidentStatus.Open && (this.resolvedAt || this.resolvedByStaffId || this.resolutionNotes)) {
      throw new Error('open incidents must not define resolution fields')
    }
    if (this.updatedAt.getTime() < this.createdAt.getTime()) {
      throw new Error('updatedAt must not be before createdAt')
    }
  }
}

export const incidentConfig: EntityConfigFactory<Incident> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.incidents,
    tenant: directSchoolTenant(),
    read: read(permissionAction(policy, Permission.DISCIPLINE_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.DISCIPLINE_CREATE), authorizeIncident(policy), authorizeIncidentDelete(policy)),
    gates: {
      preSave: validateIncidentSave,
      preDelete: validateIncidentDelete,
    },
    atomicExecution,
  })

function authorizeIncident(policy: AuthorizationPolicy): EntityWriteAuthorization<Incident>['authorizeSave'] {
  return async (actor, entity) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.sessionId)
      await policy.checkSessionAccess(actor, [entity.sessionId])
  }
}

function authorizeIncidentDelete(policy: AuthorizationPolicy): EntityWriteAuthorization<Incident>['authorizeDelete'] {
  return async (actor, entity) => {
    if (entity.classGroupId)
      await policy.checkClassGroupAccess(actor, [entity.classGroupId])
    if (entity.sessionId)
      await policy.checkSessionAccess(actor, [entity.sessionId])
  }
}

async function validateIncidentSave(
  entity: Incident,
  existing: Incident | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  await validateIncidentScope(entity, repositories)
  if (!existing)
    return

  const resolvesIncident = existing.status !== IncidentStatus.Resolved
    && entity.status === IncidentStatus.Resolved
  if (resolvesIncident && existing.status !== IncidentStatus.Open) {
    throw new BusinessRuleViolationError('INCIDENT_NOT_OPEN', `Incident ${existing.id} is not open`)
  }
  if (
    existing.status === IncidentStatus.Resolved
    && entity.status === IncidentStatus.Resolved
    && incidentResolutionChanged(entity, existing)
  ) {
    throw new BusinessRuleViolationError('INCIDENT_ALREADY_RESOLVED', `Incident ${existing.id} is already resolved`)
  }
}

async function validateIncidentScope(entity: Incident, repositories: SchoolRepositories): Promise<void> {
  if (entity.sessionId) {
    const session = await repositories.sessions.findById(entity.sessionId)
    const classGroup = session ? await repositories.classGroups.findById(session.classGroupId) : undefined
    if (
      !session
      || !classGroup
      || classGroup.schoolId !== entity.schoolId
      || (entity.classGroupId && classGroup.id !== entity.classGroupId)
    ) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    return
  }
  if (entity.classGroupId) {
    const classGroup = await repositories.classGroups.findById(entity.classGroupId)
    if (!classGroup || classGroup.schoolId !== entity.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
  }
}

function incidentResolutionChanged(entity: Incident, existing: Incident): boolean {
  return entity.resolutionNotes !== existing.resolutionNotes
    || dateTime(entity.resolvedAt) !== dateTime(existing.resolvedAt)
    || entity.resolvedByStaffId !== existing.resolvedByStaffId
}

async function validateIncidentDelete(
  incident: Incident,
  repositories: SchoolRepositories,
): Promise<void> {
  const [involvements, actions, attachments] = await Promise.all([
    repositories.studentIncidentInvolvements.list({ incidentId: incident.id }),
    repositories.studentDisciplinaryActions.list({ incidentId: incident.id }),
    repositories.attachments.list({ ownerKind: AttachmentOwnerKind.Incident, ownerId: incident.id }),
  ])
  if (involvements.length > 0 || actions.length > 0 || attachments.length > 0) {
    throw new BusinessRuleViolationError('INCIDENT_HAS_DEPENDENCIES', `Cannot delete incident ${incident.id}: dependent records still exist`)
  }
}
