import type { SchoolRepositories, SchoolService } from '@edaya/core'
import type { SeedApplication } from '../types'
import type { HttpSeedClient } from './client'
import type { CoreHttpRequestOptions } from './core-entity'
import {
  postCoreCommand,
  postEntityFindById,
  postEntityFindOne,
  postEntityList,
  postEntitySave,
} from './core-entity'

export interface CreateCoreHttpSeedApplicationOptions {
  client: HttpSeedClient
  serviceAccountApiKey?: string
}

function createRepositoryProxy(
  serviceName: string,
  requestOptions: CoreHttpRequestOptions,
) {
  return {
    list: async () => postEntityList(requestOptions, serviceName),
    findById: async (id: string) => postEntityFindById(requestOptions, serviceName, id),
    findOne: async (query: Record<string, unknown>) => postEntityFindOne(requestOptions, serviceName, query),
    save: async (entity: unknown) => postEntitySave(requestOptions, serviceName, entity),
  }
}

function createBaseServiceProxy(requestOptions: CoreHttpRequestOptions): Record<string, unknown> {
  return new Proxy({}, {
    get(_target, serviceName: string) {
      return {
        save: async (entity: unknown) => postEntitySave(requestOptions, serviceName, entity),
      }
    },
  })
}

function createSchoolServiceProxy(
  requestOptions: CoreHttpRequestOptions,
): SchoolService {
  const baseService = createBaseServiceProxy(requestOptions)

  return new Proxy({ baseService } as unknown as SchoolService, {
    get(target, property, receiver) {
      if (property === 'baseService') {
        return baseService
      }

      if (typeof property !== 'string') {
        return Reflect.get(target, property, receiver)
      }

      return async (payload: unknown) => postCoreCommand(requestOptions, property, payload)
    },
  })
}

export function createCoreHttpSeedApplication(
  options: CreateCoreHttpSeedApplicationOptions,
): SeedApplication {
  const repositoriesCache = new Map<string, ReturnType<typeof createRepositoryProxy>>()
  const requestOptions: CoreHttpRequestOptions = {
    client: options.client,
    serviceAccountApiKey: options.serviceAccountApiKey,
    requestId: 'http-seed',
  }

  function repositoryProxy(serviceName: string) {
    const cached = repositoriesCache.get(serviceName)
    if (cached) {
      return cached
    }

    const proxy = createRepositoryProxy(serviceName, requestOptions)
    repositoriesCache.set(serviceName, proxy)
    return proxy
  }

  return {
    repositories: new Proxy({} as SchoolRepositories, {
      get(_target, serviceName: string) {
        return repositoryProxy(serviceName)
      },
    }) as SchoolRepositories,
    forActor(): SchoolService {
      return createSchoolServiceProxy(requestOptions)
    },
  }
}
