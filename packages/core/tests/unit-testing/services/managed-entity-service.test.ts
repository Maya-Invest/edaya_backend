import type { BaseRepositoryInterface, SchoolRepositories } from '../../../src/ports'
import type { ActorMetadata } from '../../../src/services/authorization'
import { describe, expect, mock, test } from 'bun:test'
import { AcademicYear, ClassGroup, Resource, ResourceAssignment, ResourceKind, Subject, SubjectMatter } from '../../../src/entities'
import { AuthorizationError } from '../../../src/services/authorization'
import { ManagedEntityService } from '../../../src/services/entities'
import { BusinessRuleViolationError } from '../../../src/services/shared/business-rule-error'
import { createStore, createTestApp } from '../../support/in-memory-school-headless-app'

interface TestEntity {
  id: string
  schoolId: string
  parentId?: string
}

const actor: ActorMetadata = {
  kind: 'system',
  systemId: 'system',
  schoolId: 'school',
  requestId: 'request',
  reason: 'test',
}

function createRepository<T extends { id: string }>(): BaseRepositoryInterface<T> {
  return createStore<T>() as BaseRepositoryInterface<T>
}

describe('ManagedEntityService', () => {
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
    expect(preSave).toHaveBeenCalledWith(entity, undefined, {})
    await expect(repository.findById(entity.id)).resolves.toEqual(entity)
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
    expect(preSave).toHaveBeenCalledWith(updated, existing, {})
    expect(preSave).toHaveBeenCalledWith(created, undefined, {})
    await expect(repository.findById('entity-1')).resolves.toEqual(updated)
    await expect(repository.findById('entity-2')).resolves.toEqual(created)
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
})

describe('BaseSchoolService managed entity wiring', () => {
  test('blocks deleting an academic year with class groups', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.academicYearRepository.save(new AcademicYear({
      id: 'year-1',
      schoolId: 'school',
      name: '2026',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    }))
    await repositories.classGroupRepository.save(new ClassGroup({
      id: 'class-1',
      schoolId: 'school',
      academicYearId: 'year-1',
      gradeLevelId: 'grade-1',
      name: 'Grade 1',
    }))

    await expect(app.base.academicYears.delete('year-1')).rejects.toBeInstanceOf(BusinessRuleViolationError)
  })

  test('uses indirect tenant resolution for resource assignments', async () => {
    const { app, repositories } = createTestApp(actor)
    await repositories.resourceRepository.save(new Resource({
      id: 'resource-1',
      schoolId: 'other-school',
      name: 'Room A',
      kind: ResourceKind.Location,
    }))

    await expect(app.base.resourceAssignments.save(new ResourceAssignment({
      id: 'assignment-1',
      resourceId: 'resource-1',
      classGroupId: 'class-1',
    }))).rejects.toBeInstanceOf(AuthorizationError)
  })
})

describe('ConfigService managed entity facade', () => {
  test('uses managed proposed-state authorization for subject matters', async () => {
    const { app, repositories } = createTestApp(actor)

    await expect(app.config.subjectMatters.save(new SubjectMatter({
      id: 'matter-1',
      subjectId: 'missing-subject',
      name: 'Algebra',
      sequenceOrder: 1,
    }))).rejects.toBeInstanceOf(AuthorizationError)

    await repositories.subjectRepository.save(new Subject({
      id: 'subject-1',
      schoolId: 'school',
      name: 'Math',
    }))
    const subjectMatter = new SubjectMatter({
      id: 'matter-1',
      subjectId: 'subject-1',
      name: 'Algebra',
      sequenceOrder: 1,
    })

    await app.config.subjectMatters.save(subjectMatter)

    await expect(repositories.subjectMatterRepository.findById('matter-1')).resolves.toEqual(subjectMatter)
  })
})
