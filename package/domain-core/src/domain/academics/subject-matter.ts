import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import { z } from 'zod'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, operationModule, read, write } from '../../application/entities/entity-config'
import { AcademicsOperations, AuthorizationError, AuthorizationErrorCode } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

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
export type SubjectMatterInput = z.input<typeof subjectMatterSchema>

export const subjectMatterCreateSchema = subjectMatterSchema.omit({ createdAt: true })
export const subjectMatterUpdateSchema = subjectMatterSchema.partial().required({ id: true })

export class SubjectMatter {
  readonly data: SubjectMatterData

  constructor(args: SubjectMatterInput) {
    this.data = parseDomain(subjectMatterSchema, args)
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
    read: read(operationModule(AcademicsOperations.curriculumRead), noopReadAccess),
    write: write(operationModule(AcademicsOperations.programUpdate), authorizeSubjectMatter(policy), authorizeSubjectMatterDelete(policy)),
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
