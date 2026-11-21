import type { AccessPolicies, SchoolScopedActorMetadata } from '@edaya/authorization'
import type { AtomicExecutionPort, BaseRepositoryInterface, CoreEntityKey, CoreEntityMap, Filter, QueryOptions, ResourceAccessScope } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { AuthorizationError, AuthorizationErrorCode, createAccessPolicies } from '@edaya/authorization'
import { BusinessRuleViolationError, ReportCardResult, ReportCardResultSection } from '@edaya/core'
import { visibleReportRevision } from '../../capabilities/academics/report-comment-revisions'
import { assertTeacherWorkflowWrite, recordTeacherWorkflowDecision } from '../../capabilities/academics/teacher-workflow-boundaries'

export interface EntityTenantResolver<T> {
  resolve: (entity: T, repositories: SchoolRepositories) => Promise<string | undefined> | string | undefined
  resolveFromFilter?: (filter: Filter<T> | QueryOptions<T> | undefined) => string | undefined
  scopeFilter?: (schoolId: string, repositories: SchoolRepositories) => Filter<T> | Promise<Filter<T>>
}

export interface EntityBusinessGates<T> {
  prepareBatch?: (entities: T[], repositories: SchoolRepositories) => Promise<SchoolRepositories>
  preSave?: (entity: T, existing: T | undefined, repositories: SchoolRepositories) => Promise<void>
  preDelete?: (entity: T, repositories: SchoolRepositories) => Promise<void>
}
export interface EntityBusinessHooks<T> {
  /** Opt-in: gates validate all proposals together before bulk persistence. */
  postBatchSave?: (entities: T[], repositories: SchoolRepositories, actor: SchoolScopedActorMetadata, existingById: ReadonlyMap<string | undefined, T>) => Promise<void>
  postSave?: (entity: T, existing: T | undefined, repositories: SchoolRepositories, actor: SchoolScopedActorMetadata) => Promise<void>
  postDelete?: (entity: T, repositories: SchoolRepositories, actor: SchoolScopedActorMetadata) => Promise<void>
}
export interface ManagedEntityServiceConfig<T> {
  prepareSave?: (entity: T, existing: T | undefined) => T
  repository: BaseRepositoryInterface<T>
  tenant: EntityTenantResolver<T>
  resource: CoreEntityKey
  gates?: EntityBusinessGates<T>
  hooks?: EntityBusinessHooks<T>
  atomicExecution?: AtomicExecutionPort
  projectRead?: (entity: T) => Promise<T>
  writeLockGroup?: string
  additionalWriteLockGroups?: string[]
}
export interface ManagedEntityServiceArgs<T> {
  actor: SchoolScopedActorMetadata
  repositories: SchoolRepositories
  config: ManagedEntityServiceConfig<T>
}

export class ManagedEntityService<T> {
  private readonly actor: SchoolScopedActorMetadata
  private readonly repositories: SchoolRepositories
  private readonly config: ManagedEntityServiceConfig<T>
  private readonly access: ReturnType<typeof createAccessPolicies>

  constructor(args: ManagedEntityServiceArgs<T>) {
    this.actor = args.actor
    this.repositories = args.repositories
    this.config = args.config
    this.access = createAccessPolicies({ actor: args.actor, repositories: args.repositories })
  }

  private async projectRead(row: T): Promise<T> {
    if (this.config.resource !== 'results')
      return this.config.projectRead ? this.config.projectRead(row) : row
    const result = row as CoreEntityMap['results']
    const state = await this.repositories.teacherCorrections.state(this.actor.schoolId, 'report_comments', result.id)
    let visible = visibleReportRevision(result, state)
    const clearRanks = (sections: readonly ReportCardResultSection[]): ReportCardResultSection[] => sections.map(section => new ReportCardResultSection({ ...(section.data ?? section), rank: undefined, participantCount: undefined, subResults: clearRanks(section.subResults) }))
    if (visible.grading || visible.revisedDraft) {
      const group = await this.repositories.classGroups.findById(result.classGroupId)
      const level = group && await this.repositories.gradeLevels.findById(group.gradeLevelId)
      const policy = group && level?.gradingPolicyFor(group.academicYearId)
      const pending = group && level && policy && (policy.status !== 'completed' || await this.repositories.assessmentDependencies.pendingGradingClass({ schoolId: level.schoolId, gradeLevelId: level.id, academicYearId: group.academicYearId, policyRevision: policy.revision }))
      if (pending)
        visible = new ReportCardResult({ ...visible.data, sectionResults: visible.status === 'published' ? [...visible.sectionResults] : clearRanks(visible.sectionResults), rank: visible.status === 'published' ? visible.rank : undefined, revisedDraft: visible.revisedDraft ? { ...visible.revisedDraft, rank: undefined, sectionResults: clearRanks(visible.revisedDraft.sectionResults) } : undefined })
    }
    if (visible.calculationStale && visible.status !== 'published')
      visible = new ReportCardResult({ ...visible.data, sectionResults: clearRanks(visible.sectionResults), rank: undefined, classSize: undefined })
    if (visible.revisedDraft?.calculationStale)
      visible = new ReportCardResult({ ...visible.data, sectionResults: [...visible.sectionResults], revisedDraft: { ...visible.revisedDraft, rank: undefined, classSize: undefined, sectionResults: clearRanks(visible.revisedDraft.sectionResults) } })
    return (this.actor.kind === 'guardian' || this.actor.kind === 'student'
      ? new ReportCardResult({ ...visible.data, sectionResults: [...visible.sectionResults], revisedDraft: undefined, publicationHistory: [] })
      : visible) as T
  }

  private async readRepository(access: AccessPolicies = this.access): Promise<BaseRepositoryInterface<T>> {
    if (access.actor !== this.actor || access.repositories !== this.repositories)
      this.deny()
    return this.config.repository.forAccess(await access.entity(this.config.resource).readScope())
  }

  async findById(id: string, access?: AccessPolicies): Promise<T | undefined> {
    const row = await (await this.readRepository(access)).findById(id)
    return row ? this.projectRead(row) : undefined
  }

  async findByIds(ids: readonly string[], access?: AccessPolicies): Promise<T[]> {
    return Promise.all((await (await this.readRepository(access)).findByIds(ids)).map(row => this.projectRead(row)))
  }

  async findOne(options?: QueryOptions<T>): Promise<T | undefined> {
    this.ensureFilterTenant(options)
    const row = await (await this.readRepository()).findOne(options)
    return row ? this.projectRead(row) : undefined
  }

  async list(options?: QueryOptions<T>, access?: AccessPolicies): Promise<T[]> {
    this.ensureFilterTenant(options)
    return Promise.all((await (await this.readRepository(access)).list(options)).map(row => this.projectRead(row)))
  }

  async count(filter?: Filter<T>): Promise<number> {
    this.ensureFilterTenant(filter)
    return (await this.readRepository()).count(filter)
  }

  async save(entity: T, correctingIdentifier = false): Promise<void> {
    await this.executeWrite(async () => {
      const id = getEntityId(entity)
      const existing = id ? await this.tenantRepository().findById(id) : undefined
      entity = this.config.prepareSave?.(entity, existing) ?? entity
      if (!correctingIdentifier)
        this.assertIdentifierPreserved(entity, existing)
      const { repository } = await this.authorizeSave(entity, existing)
      await this.config.gates?.preSave?.(entity, existing, this.repositories)
      await repository.save(entity)
      await this.config.hooks?.postSave?.(entity, existing, this.repositories, this.actor)
      await recordTeacherWorkflowDecision(this.actor, this.config.resource, entity, existing, this.repositories)
    })
  }

  async batchSave(entities: T[]): Promise<string[]> {
    return this.executeWrite(async () => {
      const ids = entities.map(getEntityId)
      if (ids.some(id => !id) || new Set(ids).size !== ids.length)
        this.deny()
      const existing = await this.tenantRepository().findByIds(ids as string[])
      const existingById = new Map(existing.map(entity => [getEntityId(entity), entity]))
      entities = entities.map(entity => this.config.prepareSave?.(entity, existingById.get(getEntityId(entity))) ?? entity)
      const access = this.access.forOperation()
      const validationRepositories = await this.config.gates?.prepareBatch?.(entities, this.repositories) ?? this.repositories
      for (const entity of entities) {
        await this.ensureEntityTenant(entity, validationRepositories)
        const before = existingById.get(getEntityId(entity))
        if (before)
          await this.ensureEntityTenant(before, validationRepositories)
      }
      const scopes = await access.entity(this.config.resource).assertBatchSave(entities as CoreEntityMap[CoreEntityKey][], existingById as Map<string, CoreEntityMap[CoreEntityKey]>)
      for (const entity of entities)
        this.assertIdentifierPreserved(entity, existingById.get(getEntityId(entity)))
      for (const entity of entities) await assertTeacherWorkflowWrite(this.actor, this.config.resource, entity, existingById.get(getEntityId(entity)), this.repositories)
      const authorized = scopes.map(scope => ({ scope, repository: this.config.repository.forAccess(scope) }))
      if (authorized.length && ((!this.config.gates?.preSave && !this.config.hooks?.postSave) || this.config.hooks?.postBatchSave)) {
        for (const entity of entities) await this.config.gates?.preSave?.(entity, existingById.get(getEntityId(entity)), validationRepositories)
        // Each proposed and existing row was authorized above. The adapter rechecks
        // both row ownership predicates inside a bounded, atomic bulk write.
        const groups = new Map<string, { repository: BaseRepositoryInterface<T>, entities: T[] }>()
        for (const [index, entity] of entities.entries()) {
          const { repository, scope } = authorized[index]!
          const key = JSON.stringify(scope)
          const group = groups.get(key) ?? { repository, entities: [] }
          group.entities.push(entity)
          groups.set(key, group)
        }
        for (const group of groups.values()) await group.repository.batchSave(group.entities)
        await this.config.hooks?.postBatchSave?.(entities, this.repositories, this.actor, existingById)
        for (const entity of entities) await recordTeacherWorkflowDecision(this.actor, this.config.resource, entity, existingById.get(getEntityId(entity)), this.repositories)
        return ids as string[]
      }
      for (const [index, entity] of entities.entries()) {
        // All authorization is preflighted; business validation sees earlier writes
        // in this transaction, so conflicting proposals cannot bypass invariants.
        await this.config.gates?.preSave?.(entity, existingById.get(getEntityId(entity)), validationRepositories)
        await authorized[index]!.repository.save(entity)
        await this.config.hooks?.postSave?.(entity, existingById.get(getEntityId(entity)), this.repositories, this.actor)
        await recordTeacherWorkflowDecision(this.actor, this.config.resource, entity, existingById.get(getEntityId(entity)), this.repositories)
      }
      return ids as string[]
    })
  }

  async delete(id: string): Promise<void> {
    await this.batchDelete([id])
  }

  async batchDelete(ids: string[]): Promise<void> {
    await this.executeWrite(async () => {
      const uniqueIds = [...new Set(ids)]
      if (!uniqueIds.length)
        return
      const scope = await this.access.entity(this.config.resource).assertDelete(uniqueIds)
      const repository = this.config.repository.forAccess(scope)
      const entities = await this.tenantRepository().findByIds(uniqueIds)
      if (entities.length !== uniqueIds.length)
        this.deny()
      for (const entity of entities) {
        await repository.assertAccess(entity)
        await assertTeacherWorkflowWrite(this.actor, this.config.resource, entity, undefined, this.repositories)
        await this.config.gates?.preDelete?.(entity, this.repositories)
      }
      await repository.batchDelete(uniqueIds)
      for (const entity of entities) await this.config.hooks?.postDelete?.(entity, this.repositories, this.actor)
    })
  }

  private assertIdentifierPreserved(entity: T, existing?: T) {
    if (existing && entity && typeof entity === 'object' && typeof existing === 'object'
      && 'identifier' in entity && 'identifier' in existing && entity.identifier !== existing.identifier) {
      throw new BusinessRuleViolationError('IDENTIFIER_CORRECTION_REQUIRED', 'Use the identifier correction command')
    }
  }

  private async authorizeSave(entity: T, existing: T | undefined, access = this.access, repositories = this.repositories): Promise<{ repository: BaseRepositoryInterface<T>, scope: ResourceAccessScope }> {
    await this.ensureEntityTenant(entity, repositories)
    if (existing)
      await this.ensureEntityTenant(existing, repositories)
    const scope = await access.entity(this.config.resource).assertSave(entity as CoreEntityMap[CoreEntityKey], existing as CoreEntityMap[CoreEntityKey] | undefined)
    await assertTeacherWorkflowWrite(this.actor, this.config.resource, entity, existing, repositories)
    return { repository: this.config.repository.forAccess(scope), scope }
  }

  private tenantRepository(): BaseRepositoryInterface<T> {
    if (!this.config.repository.forSchool)
      return this.deny()
    return this.config.repository.forSchool(this.actor.schoolId)
  }

  private async executeWrite<R>(operation: () => Promise<R>): Promise<R> {
    if (!this.config.atomicExecution)
      throw new Error('Entity writes require atomic execution')
    return this.config.atomicExecution.execute(operation, {
      lockKeys: [...(this.config.writeLockGroup ? [this.config.writeLockGroup] : []), ...this.config.additionalWriteLockGroups ?? []].map(group => `${group}:${this.actor.schoolId}`),
    }).catch((error: unknown) => {
      for (let cause = error; cause && typeof cause === 'object'; cause = 'cause' in cause ? cause.cause : undefined) {
        if ('code' in cause && cause.code === '23505' && 'constraint' in cause
          && /^(?:students|teachers|guardians|staff_members)_school_identifier_uidx$/.test(String(cause.constraint))) {
          throw new BusinessRuleViolationError('IDENTIFIER_UNAVAILABLE', 'This identifier is unavailable', { field: 'identifier' })
        }
      }
      throw error
    })
  }

  private ensureFilterTenant(filter: Filter<T> | QueryOptions<T> | undefined): void {
    const schoolId = this.config.tenant.resolveFromFilter?.(filter)
    if (schoolId && schoolId !== this.actor.schoolId)
      this.deny()
  }

  private async ensureEntityTenant(entity: T, repositories = this.repositories): Promise<void> {
    if (await this.config.tenant.resolve(entity, repositories) !== this.actor.schoolId)
      this.deny()
  }

  private deny(): never { throw new AuthorizationError(AuthorizationErrorCode.Forbidden) }
}

function getEntityId(entity: unknown): string | undefined {
  return entity && typeof entity === 'object' && 'id' in entity && typeof entity.id === 'string' ? entity.id : undefined
}
