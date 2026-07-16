import type { BaseRepositoryInterface } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'

const SKIPPED_REPOSITORY_KEYS = new Set([
  'authorization',
  'cronJobSchedules',
  'schools',
  'serviceApiKeys',
  'accountInvitations',
  'schoolNotificationTemplates',
])

function serializeLookupKey(value: unknown): string {
  return JSON.stringify(value ?? null)
}

function wrapRepositoryWithLookupCache<T>(
  repository: BaseRepositoryInterface<T>,
  cache: Map<string, unknown>,
  repositoryKey: string,
): BaseRepositoryInterface<T> {
  return {
    ...repository,
    async findById(id: string) {
      const cacheKey = `${repositoryKey}:findById:${id}`
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey) as T | undefined
      }

      const entity = await repository.findById(id)
      cache.set(cacheKey, entity)
      return entity
    },
    async findOne(options, last) {
      const cacheKey = `${repositoryKey}:findOne:${serializeLookupKey(options)}:${last === true}`
      if (cache.has(cacheKey)) {
        return cache.get(cacheKey) as T | undefined
      }

      const entity = await repository.findOne(options, last)
      cache.set(cacheKey, entity)
      return entity
    },
  }
}

export function withTenantLookupCache(repositories: SchoolRepositories): SchoolRepositories {
  const cache = new Map<string, unknown>()
  const wrappedEntries = Object.entries(repositories).map(([key, repository]) => {
    if (SKIPPED_REPOSITORY_KEYS.has(key)) {
      return [key, repository] as const
    }

    if (!repository || typeof repository !== 'object') {
      return [key, repository] as const
    }

    const typedRepository = repository as BaseRepositoryInterface<unknown>
    if (typeof typedRepository.findById !== 'function' || typeof typedRepository.findOne !== 'function') {
      return [key, repository] as const
    }

    return [key, wrapRepositoryWithLookupCache(typedRepository, cache, key)] as const
  })

  return Object.fromEntries(wrappedEntries) as SchoolRepositories
}
