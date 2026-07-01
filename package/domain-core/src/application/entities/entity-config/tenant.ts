import type { EntityTenantResolver } from '../../../application/entities/managed-entity-service'
import type { Filter, QueryOptions } from '../../../ports/repositories/base-repository'
import type { SchoolRepositories } from '../../../ports/repositories/school-repositories'
import type { EntityWithSchoolId } from './config'

export async function resolveClassSubjectSchoolId(repositories: SchoolRepositories, classSubjectId: string): Promise<string | undefined> {
  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject)
    return undefined
  const classGroup = await repositories.classGroups.findById(classSubject.classGroupId)
  return classGroup?.schoolId
}

export async function resolveActivitySessionSchoolId(repositories: SchoolRepositories, activitySessionId: string): Promise<string | undefined> {
  const activitySession = await repositories.activitySessions.findById(activitySessionId)
  return activitySession?.schoolId
}

export async function resolveLessonSessionSchoolId(repositories: SchoolRepositories, lessonSessionId: string): Promise<string | undefined> {
  const lessonSession = await repositories.lessonSessions.findById(lessonSessionId)
  return lessonSession?.schoolId
}

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
