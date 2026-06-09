import type { AuthorizationPolicy } from '../../authorization/authorization-policy'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { AuthorizationError, AuthorizationErrorCode } from '../../authorization/authorization-error'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, permissionAction, read, write } from '../../shared'
import { requireNonBlank, requireOptionalNonBlank, requirePositiveNumber } from '../utils'

export interface SubjectMatterArgs {
  id: string
  subjectId: string
  name: string
  description?: string | null
  sequenceOrder: number
  estimatedHours?: number | null
  createdAt?: Date
}

export class SubjectMatter {
  readonly id: string
  readonly subjectId: string
  readonly name: string
  readonly description?: string
  readonly sequenceOrder: number
  readonly estimatedHours?: number
  readonly createdAt: Date

  constructor({ id, subjectId, name, description, sequenceOrder, estimatedHours, createdAt }: SubjectMatterArgs) {
    this.id = requireNonBlank(id, 'id')
    this.subjectId = requireNonBlank(subjectId, 'subjectId')
    this.name = requireNonBlank(name, 'name')
    this.description = requireOptionalNonBlank(description, 'description')
    this.sequenceOrder = requirePositiveNumber(sequenceOrder, 'sequenceOrder')
    if (estimatedHours != null) {
      this.estimatedHours = requirePositiveNumber(estimatedHours, 'estimatedHours')
    }
    this.createdAt = createdAt ?? new Date()
  }
}

export const subjectMatterConfig: EntityConfigFactory<SubjectMatter> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.subjectMatters,
    tenant: subjectMatterTenant(),
    read: read(permissionAction(policy, Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.ACADEMIC_PROGRAM_UPDATE), authorizeSubjectMatter(policy), authorizeSubjectMatterDelete(policy)),
    atomicExecution,
  })

function subjectMatterTenant(): EntityTenantResolver<SubjectMatter> {
  return indirectTenant(async (entity, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    return subject?.schoolId
  })
}

function authorizeSubjectMatter(_policy: AuthorizationPolicy): EntityWriteAuthorization<SubjectMatter>['authorizeSave'] {
  return async (actor, entity, _existing, repositories) => {
    const subject = await repositories.subjects.findById(entity.subjectId)
    if (!subject || subject.schoolId !== actor.schoolId)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

function authorizeSubjectMatterDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<SubjectMatter>['authorizeDelete'] {
  return noopDeleteAccess
}
