import type { ActorMetadata, SchoolRepositories, SchoolService } from '@edaya/core'
import type { SeedApplication } from '../types'
import type { HttpSeedClient } from './client'
import type { SystemHttpRequestOptions } from './system-entity'
import { SEED_SCHOOL_ID } from '@edaya/dev-fixtures'
import {
  postSystemCommand,
  postSystemEntityFindById,
  postSystemEntityFindOne,
  postSystemEntityList,
  postSystemEntitySave,

} from './system-entity'

export interface CreateSystemHttpSeedApplicationOptions {
  client: HttpSeedClient
  systemActorSecret: string
}

function createRepositoryProxy(
  serviceName: string,
  requestOptions: SystemHttpRequestOptions,
) {
  return {
    list: async () => postSystemEntityList(requestOptions, serviceName),
    findById: async (id: string) => postSystemEntityFindById(requestOptions, serviceName, id),
    findOne: async (query: Record<string, unknown>) => postSystemEntityFindOne(requestOptions, serviceName, query),
    save: async (entity: unknown) => postSystemEntitySave(requestOptions, serviceName, entity),
  }
}

function createBaseServiceProxy(requestOptions: SystemHttpRequestOptions): Record<string, unknown> {
  return new Proxy({}, {
    get(_target, serviceName: string) {
      return {
        save: async (entity: unknown) => postSystemEntitySave(requestOptions, serviceName, entity),
      }
    },
  })
}

function createSchoolServiceProxy(
  requestOptions: SystemHttpRequestOptions,
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

      return async (payload: unknown) => postSystemCommand(requestOptions, property, payload)
    },
  })
}

export function createSystemHttpSeedApplication(
  options: CreateSystemHttpSeedApplicationOptions,
): SeedApplication {
  const repositoriesCache = new Map<string, ReturnType<typeof createRepositoryProxy>>()

  function repositoryProxy(serviceName: string) {
    const cached = repositoriesCache.get(serviceName)
    if (cached) {
      return cached
    }

    const actor: ActorMetadata = {
      kind: 'system',
      systemId: 'http-seed',
      schoolId: SEED_SCHOOL_ID,
      requestId: 'http-seed',
      reason: 'HTTP system entity access',
    }
    const proxy = createRepositoryProxy(serviceName, {
      client: options.client,
      systemActorSecret: options.systemActorSecret,
      actor,
    })
    repositoriesCache.set(serviceName, proxy)
    return proxy
  }

  return {
    repositories: new Proxy({} as SchoolRepositories, {
      get(_target, serviceName: string) {
        return repositoryProxy(serviceName)
      },
    }) as SchoolRepositories,
    forActor(actor: ActorMetadata): SchoolService {
      return createSchoolServiceProxy({
        client: options.client,
        systemActorSecret: options.systemActorSecret,
        actor,
      })
    },
  }
}
