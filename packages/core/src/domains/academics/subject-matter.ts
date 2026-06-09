import type { AuthorizationPolicy } from '../../authorization/authorization-policy'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { z } from 'zod'
import { Permission } from '../../authorization'
import { AuthorizationError, AuthorizationErrorCode } from '../../authorization/authorization-error'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, permissionAction, read, write } from '../../shared'
import { DomainValidationError, formatZodError, zodDate } from '../utils'

export const subjectMatterSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  subjectId: z.string().trim().min(1, 'subjectId must not be blank'),
  name: z.string().trim().min(1, 'name must not be blank'),
  description: z.string().trim().min(1, 'description must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  sequenceOrder: z.number().positive('sequenceOrder must be positive'),
  estimatedHours: z.number().positive('estimatedHours must be positive').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
})

export type SubjectMatterData = z.infer<typeof subjectMatterSchema>

export const subjectMatterCreateSchema = subjectMatterSchema.omit({ createdAt: true })
export const subjectMatterUpdateSchema = subjectMatterSchema.partial().required({ id: true })

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
  readonly data: SubjectMatterData

  constructor(args: SubjectMatterArgs) {
    const result = subjectMatterSchema.safeParse(args)
    if (!result.success) {
      throw new DomainValidationError(formatZodError(result.error))
    }
    this.data = result.data
  }

  get id() { return this.data.id }
  get subjectId() { return this.data.subjectId }
  get name() { return this.data.name }
  get description() { return this.data.description }
  get sequenceOrder() { return this.data.sequenceOrder }
  get estimatedHours() { return this.data.estimatedHours }
  get createdAt() { return this.data.createdAt }
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
