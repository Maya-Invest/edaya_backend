import type { ActorMetadata } from '@edaya/authorization'
import type { SchoolRepositories } from '@edaya/service'
import type { TestEntity } from './managed-entity-test-context'
import {
  AuthorizationError,
  AuthorizationErrorCode,
  createStaffActorMetadata,
} from '@edaya/authorization'
import { ManagedEntityService } from '@edaya/service'
import {
  describe,
  expect,
  mock,
  test,
} from 'bun:test'
import {
  actor,
  createRepository,

} from './managed-entity-test-context'

describe('ManagedEntityService', () => {
  function createService(
    repository = createRepository<TestEntity>(),
    overrides: Partial<ConstructorParameters<typeof ManagedEntityService<TestEntity>>[0]['config']> = {},
  ): ManagedEntityService<TestEntity> {
    return new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: {
          resolve: value => value.schoolId,
          resolveFromFilter: filter => (filter as { schoolId?: string } | undefined)?.schoolId,
        },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
        ...overrides,
      },
    })
  }

  test('findById, findOne, and list handle missing and authorized results', async () => {
    const repository = createRepository<TestEntity>()
    const entity = { id: 'entity-1', schoolId: 'school' }
    await repository.save(entity)
    const checkAccess = mock(async () => {})
    const service = createService(repository, {
      read: {
        checkModule: mock(async () => {}),
        checkAccess,
      },
    })

    await expect(service.findById('missing')).resolves.toBeUndefined()
    await expect(service.findById(entity.id)).resolves.toEqual(entity)
    await expect(service.findOne({ id: 'missing' })).resolves.toBeUndefined()
    await expect(service.findOne({ id: entity.id })).resolves.toEqual(entity)
    await expect(service.list({ schoolId: 'school' })).resolves.toEqual([entity])

    expect(checkAccess).toHaveBeenCalledWith(actor, [entity], {})
  })

  test('rejects cross-school read filters before repository access', async () => {
    const repository = createRepository<TestEntity>()
    const service = createService(repository)

    await expect(service.findOne({ schoolId: 'other-school' })).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.list({ schoolId: 'other-school' })).rejects.toBeInstanceOf(AuthorizationError)
    expect(await repository.count()).toBe(0)
  })

  test('findByIds checks module, tenant, and entity access', async () => {
    const repository = createRepository<TestEntity>()
    const first = { id: 'entity-1', schoolId: 'school' }
    const second = { id: 'entity-2', schoolId: 'school' }
    await repository.batchSave([first, second])
    const checkModule = mock(async () => {})
    const checkAccess = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule,
          checkAccess,
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    const result = await service.findByIds(['entity-1', 'entity-2'])

    expect(result).toEqual([first, second])
    expect(checkModule).toHaveBeenCalledWith(actor)
    expect(checkAccess).toHaveBeenCalledWith(actor, [first, second], {})
  })

  test('passes undefined existing state to save gates for creates', async () => {
    const repository = createRepository<TestEntity>()
    const authorizeSave = mock(async () => {})
    const preSave = mock(async () => {})
    const entity = { id: 'entity-1', schoolId: 'school', parentId: 'parent-1' }
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave,
          authorizeDelete: mock(async () => {}),
        },
        gates: { preSave },
      },
    })

    await service.save(entity)

    expect(authorizeSave).toHaveBeenCalledWith(actor, entity, undefined, {})
    expect(preSave).toHaveBeenCalledWith(entity, undefined, {}, actor)
    await expect(repository.findById(entity.id)).resolves.toEqual(entity)
  })

  test('runs postSave after repository save with existing state', async () => {
    const repository = createRepository<TestEntity>()
    const existing = { id: 'entity-1', schoolId: 'school', parentId: 'old-parent' }
    const updated = { id: 'entity-1', schoolId: 'school', parentId: 'new-parent' }
    await repository.save(existing)
    const postSave = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
        hooks: { postSave },
      },
    })

    await service.save(updated)

    expect(postSave).toHaveBeenCalledWith(updated, existing, {}, actor)
    await expect(repository.findById(updated.id)).resolves.toEqual(updated)
  })

  test('batchSave authorizes and gates each proposed entity with existing state', async () => {
    const repository = createRepository<TestEntity>()
    const existing = { id: 'entity-1', schoolId: 'school', parentId: 'old-parent' }
    const updated = { id: 'entity-1', schoolId: 'school', parentId: 'new-parent' }
    const created = { id: 'entity-2', schoolId: 'school' }
    await repository.save(existing)
    const authorizeSave = mock(async () => {})
    const preSave = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave,
          authorizeDelete: mock(async () => {}),
        },
        gates: { preSave },
      },
    })

    const result = await service.batchSave([updated, created])

    expect(result).toEqual(['entity-1', 'entity-2'])
    expect(authorizeSave).toHaveBeenCalledWith(actor, updated, existing, {})
    expect(authorizeSave).toHaveBeenCalledWith(actor, created, undefined, {})
    expect(preSave).toHaveBeenCalledWith(updated, existing, {}, actor)
    expect(preSave).toHaveBeenCalledWith(created, undefined, {}, actor)
    await expect(repository.findById('entity-1')).resolves.toEqual(updated)
    await expect(repository.findById('entity-2')).resolves.toEqual(created)
  })

  test('batchSave runs postSave for each entity after repository batchSave', async () => {
    const repository = createRepository<TestEntity>()
    const existing = { id: 'entity-1', schoolId: 'school', parentId: 'old-parent' }
    const updated = { id: 'entity-1', schoolId: 'school', parentId: 'new-parent' }
    const created = { id: 'entity-2', schoolId: 'school' }
    await repository.save(existing)
    const postSave = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
        hooks: { postSave },
      },
    })

    await service.batchSave([updated, created])

    expect(postSave).toHaveBeenCalledWith(updated, existing, {}, actor)
    expect(postSave).toHaveBeenCalledWith(created, undefined, {}, actor)
    expect(postSave).toHaveBeenCalledTimes(2)
  })

  test('supports moduleChecked and atomic execution for writes', async () => {
    const repository = createRepository<TestEntity>()
    const checkModule = mock(async () => {})
    const atomicExecute = mock(async (operation: () => Promise<unknown>) => operation()) as unknown as <T>(operation: () => Promise<T>) => Promise<T>
    const service = createService(repository, {
      write: {
        checkModule,
        authorizeSave: mock(async () => {}),
        authorizeDelete: mock(async () => {}),
      },
      atomicExecution: {
        execute: atomicExecute,
      },
    })

    await service.save({ id: 'entity-1', schoolId: 'school' }, { moduleChecked: true })
    await service.batchSave([{ schoolId: 'school' } as any], { moduleChecked: true })
    await service.delete('entity-1', { moduleChecked: true })
    await service.batchDelete(['missing'], { moduleChecked: true })

    expect(checkModule).not.toHaveBeenCalled()
    expect(atomicExecute).toHaveBeenCalledTimes(4)
  })

  test('rejects proposed entities outside the actor tenant', async () => {
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository: createRepository<TestEntity>(),
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await expect(service.save({ id: 'entity-1', schoolId: 'other-school' })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('delete is idempotent when the entity does not exist', async () => {
    const deleteEntity = mock(async () => {})
    const repository = {
      ...createRepository<TestEntity>(),
      delete: deleteEntity,
    }
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await service.delete('missing')

    expect(deleteEntity).not.toHaveBeenCalled()
  })

  test('runs postDelete after repository delete', async () => {
    const repository = createRepository<TestEntity>()
    const entity = { id: 'entity-1', schoolId: 'school' }
    await repository.save(entity)
    const postDelete = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
        hooks: { postDelete },
      },
    })

    await service.delete(entity.id)

    expect(postDelete).toHaveBeenCalledWith(entity, {}, actor)
    await expect(repository.findById(entity.id)).resolves.toBeUndefined()
  })

  test('batchDelete authorizes and gates existing entities only', async () => {
    const repository = createRepository<TestEntity>()
    const entity = { id: 'entity-1', schoolId: 'school' }
    await repository.save(entity)
    const authorizeDelete = mock(async () => {})
    const preDelete = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete,
        },
        gates: { preDelete },
      },
    })

    await service.batchDelete(['entity-1', 'missing'])

    expect(authorizeDelete).toHaveBeenCalledWith(actor, entity, {})
    expect(authorizeDelete).toHaveBeenCalledTimes(1)
    expect(preDelete).toHaveBeenCalledWith(entity, {})
    expect(preDelete).toHaveBeenCalledTimes(1)
    await expect(repository.findById('entity-1')).resolves.toBeUndefined()
  })

  test('batchDelete runs postDelete for existing entities only', async () => {
    const repository = createRepository<TestEntity>()
    const entity = { id: 'entity-1', schoolId: 'school' }
    await repository.save(entity)
    const postDelete = mock(async () => {})
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
        hooks: { postDelete },
      },
    })

    await service.batchDelete(['entity-1', 'missing'])

    expect(postDelete).toHaveBeenCalledWith(entity, {}, actor)
    expect(postDelete).toHaveBeenCalledTimes(1)
  })

  test('count uses repository.count for elevated staff only with an independent tenant predicate', async () => {
    const repository = createRepository<TestEntity>()
    const allowed = { id: 'entity-1', schoolId: 'school' }
    const denied = { id: 'entity-2', schoolId: 'school' }
    await repository.batchSave([allowed, denied])
    const checkAccess = mock(async () => {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    })
    const count = mock(async () => 2)
    const list = mock(async () => {
      throw new Error('list should not run for elevated count')
    })
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository: {
          ...repository,
          count,
          list,
        },
        tenant: { resolve: value => value.schoolId, scopeFilter: schoolId => ({ schoolId }) },
        read: {
          checkModule: mock(async () => {}),
          checkAccess,
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await expect(service.count()).resolves.toBe(2)
    expect(count).toHaveBeenCalledWith({ $and: [{ schoolId: actor.schoolId }, {}] })
    expect(list).not.toHaveBeenCalled()
    expect(checkAccess).not.toHaveBeenCalled()
  })

  test('count applies tenant and row access checks for non-elevated staff', async () => {
    const repository = createRepository<TestEntity>()
    const allowed = { id: 'entity-1', schoolId: 'school' }
    const denied = { id: 'entity-2', schoolId: 'school' }
    await repository.batchSave([allowed, denied])
    const checkAccess = mock(async (_actor: ActorMetadata, entities: readonly TestEntity[]) => {
      if (entities.some(entity => entity.id === denied.id))
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    })
    const limitedActor = createStaffActorMetadata({
      subjectId: 'user-1',
      schoolId: 'school',
      requestId: 'req-1',
      authenticatedAt: new Date('2026-01-01T00:00:00.000Z'),
      staffMemberId: 'staff-1',
      effectiveGrants: {
        permissions: new Set(),
        scopeGrants: [],
        isElevated: false,
      },
    })
    const service = new ManagedEntityService<TestEntity>({
      actor: limitedActor,
      repositories: {} as SchoolRepositories,
      config: {
        repository,
        tenant: { resolve: value => value.schoolId },
        read: {
          checkModule: mock(async () => {}),
          checkAccess,
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await expect(service.count()).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.count({ id: allowed.id })).resolves.toBe(1)
    expect(checkAccess).toHaveBeenCalled()
  })

  test('rejects entities whose tenant cannot be resolved', async () => {
    const service = new ManagedEntityService<TestEntity>({
      actor,
      repositories: {} as SchoolRepositories,
      config: {
        repository: createRepository<TestEntity>(),
        tenant: { resolve: () => undefined },
        read: {
          checkModule: mock(async () => {}),
          checkAccess: mock(async () => {}),
        },
        write: {
          checkModule: mock(async () => {}),
          authorizeSave: mock(async () => {}),
          authorizeDelete: mock(async () => {}),
        },
      },
    })

    await expect(service.save({ id: 'entity-1', schoolId: 'school' })).rejects.toBeInstanceOf(AuthorizationError)
  })
})
