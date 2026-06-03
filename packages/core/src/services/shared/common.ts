import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { BaseRepositoryInterface, Filter, QueryOptions } from '../../ports/base-repository'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { EntityReadAuthorization, EntityTenantResolver, EntityWriteAuthorization, ManagedEntityServiceConfig } from '../entities/managed-entity-service'

export interface EntityConfigFactoryInput {
  repositories: SchoolRepositories
  policy: AuthorizationPolicy
  atomicExecution: AtomicExecutionPort
}

export type EntityConfigFactory<T> = (input: EntityConfigFactoryInput) => ManagedEntityServiceConfig<T>

export interface EntityWithSchoolId {
  schoolId?: string
}

export interface EntityWithId {
  id: string
}

export function config<T>(input: ManagedEntityServiceConfig<T>): ManagedEntityServiceConfig<T> {
  return input
}

export function directEntityConfig<T extends EntityWithSchoolId & EntityWithId>(
  input: EntityConfigFactoryInput,
  repository: BaseRepositoryInterface<T>,
  readAction: string,
  writeAction: string,
  readAccess: EntityReadAuthorization<T>['checkAccess'] = noopReadAccess,
): ManagedEntityServiceConfig<T> {
  const { policy, atomicExecution } = input

  return config({
    repository,
    tenant: directSchoolTenant<T>(),
    read: read(action(policy, readAction), readAccess),
    write: write(action(policy, writeAction), authorizeExistingById(readAccess), authorizeDeleteByReadAccess(readAccess)),
    atomicExecution,
  })
}

export function action(policy: AuthorizationPolicy, actionName: string): (actor: ActorMetadata) => Promise<void> {
  return actor => policy.checkGlobalAction(actor, actionName)
}

export function read<T>(
  checkModule: (actor: ActorMetadata) => Promise<void>,
  checkAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityReadAuthorization<T> {
  return { checkModule, checkAccess }
}

export function write<T>(
  checkModule: (actor: ActorMetadata) => Promise<void>,
  authorizeSave: EntityWriteAuthorization<T>['authorizeSave'],
  authorizeDelete: EntityWriteAuthorization<T>['authorizeDelete'],
): EntityWriteAuthorization<T> {
  return { checkModule, authorizeSave, authorizeDelete }
}

export async function noopReadAccess(): Promise<void> {}
export async function noopSaveAccess(): Promise<void> {}
export async function noopDeleteAccess(): Promise<void> {}

export function dateTime(value: Date | undefined): number | undefined {
  return value?.getTime()
}

export function readByIds<T extends EntityWithId>(
  checkIds: (actor: ActorMetadata, ids: readonly string[]) => Promise<void>,
): EntityReadAuthorization<T>['checkAccess'] {
  return async (actor, entities) => {
    await checkIds(actor, unique(entities.map(entity => entity.id)))
  }
}

export function unique(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}
export function authorizeExistingById<T extends EntityWithId>(
  readAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity, existing, repositories) => {
    if (existing)
      await readAccess(actor, [existing], repositories)
    else if (entity.id)
      await noopReadAccess()
  }
}

// ==================== Authorization helpers ====================

export function authorizeDeleteByReadAccess<T>(
  readAccess: EntityReadAuthorization<T>['checkAccess'],
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity, repositories) => {
    await readAccess(actor, [entity], repositories)
  }
}

export function authorizeClassGroupLinked<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
  field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity[field] as string])
  }
}

export function authorizeClassGroupLinkedDelete<T extends { classGroupId: string }>(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkClassGroupAccess(actor, [entity.classGroupId])
  }
}

export function authorizeAnnouncementLinked<T extends { announcementId: string }>(
  _policy: AuthorizationPolicy,
  _field: keyof T,
): EntityWriteAuthorization<T>['authorizeSave'] {
  return noopSaveAccess
}

export function authorizeAnnouncementLinkedDelete<T extends { announcementId: string }>(
  _policy: AuthorizationPolicy,
): EntityWriteAuthorization<T>['authorizeDelete'] {
  return noopDeleteAccess
}

// ==================== linked entity resolvers helpers ====================

export async function resolveClassSubjectSchoolId(repositories: SchoolRepositories, classSubjectId: string): Promise<string | undefined> {
  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject)
    return undefined
  const classGroup = await repositories.classGroups.findById(classSubject.classGroupId)
  return classGroup?.schoolId
}

export async function resolveSessionSchoolId(repositories: SchoolRepositories, sessionId: string): Promise<string | undefined> {
  const session = await repositories.sessions.findById(sessionId)
  if (!session)
    return undefined
  const classGroup = await repositories.classGroups.findById(session.classGroupId)
  return classGroup?.schoolId
}

// ==================== Tenant resolvers helpers ====================

export function directSchoolTenant<T extends EntityWithSchoolId>(): EntityTenantResolver<T> {
  return {
    resolve: entity => entity.schoolId,
    resolveFromFilter: resolveSchoolIdFromFilter,
  }
}

export function indirectTenant<T>(
  resolve: (entity: T, repositories: SchoolRepositories) => Promise<string | undefined> | string | undefined,
): EntityTenantResolver<T> {
  return { resolve }
}

export function classGroupLinkedTenant<T extends { classGroupId: string }>(field: keyof T): EntityTenantResolver<T> {
  return indirectTenant(async (entity, repositories) => {
    const classGroup = await repositories.classGroups.findById(entity[field] as string)
    return classGroup?.schoolId
  })
}

export function announcementLinkedTenant<T extends { announcementId: string }>(field: keyof T): EntityTenantResolver<T> {
  return indirectTenant(async (entity, repositories) => {
    const announcement = await repositories.announcements.findById(entity[field] as string)
    return announcement?.schoolId
  })
}

export function resolveSchoolIdFromFilter<T>(filter: Filter<T> | QueryOptions<T> | undefined): string | undefined {
  return resolveStringFilterValue((filter as { schoolId?: unknown } | undefined)?.schoolId)
}

export function resolveIdFromFilter<T>(filter: Filter<T> | QueryOptions<T> | undefined): string | undefined {
  return resolveStringFilterValue((filter as { id?: unknown } | undefined)?.id)
}

export function resolveStringFilterValue(value: unknown): string | undefined {
  if (typeof value === 'string')
    return value
  if (!value || typeof value !== 'object')
    return undefined

  const fieldFilter = value as { $eq?: unknown, $in?: unknown }
  if (typeof fieldFilter.$eq === 'string')
    return fieldFilter.$eq
  if (Array.isArray(fieldFilter.$in) && typeof fieldFilter.$in[0] === 'string')
    return fieldFilter.$in[0]
  return undefined
}
