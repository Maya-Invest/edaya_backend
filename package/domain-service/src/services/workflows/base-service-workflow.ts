import type { AcademicPeriod, ClassGroup, CoreEntityKey, HumanIdentifierGroup, Student } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import { randomUUID } from 'node:crypto'
import { AuthorizationError, AuthorizationErrorCode, denyResourceAccess, requireActorSchoolId } from '@edaya/authorization'
import { BusinessRuleViolationError, shortNameSchema, withShortName } from '@edaya/core'
import { schoolCommandScope } from '../commands/school-command-scope'

export class BaseServiceWorkflow {
  constructor(
    readonly baseService: BaseSchoolService,
  ) {}

  protected async namedInput<T extends { id: string, name: string, shortName?: string | null }>(key: CoreEntityKey, input: T): Promise<T & { shortName: string }> {
    const previous = await this.baseService.entities[key].findById(input.id)
    const previousShortName = previous && 'shortName' in previous ? previous.shortName : undefined
    if (previous && input.shortName !== undefined)
      return { ...input, shortName: shortNameSchema.parse(input.shortName) }
    return withShortName({ ...input, shortName: input.shortName ?? (typeof previousShortName === 'string' ? previousShortName : undefined) })
  }

  protected async createHuman<T extends { id?: string, schoolId: string, requestId?: string }, R>(group: HumanIdentifierGroup, input: T, write: (data: T & { id: string }) => Promise<R>): Promise<R> {
    this.checkActorSchool(input.schoolId)
    const requestId = input.requestId ?? input.id
    if (!requestId)
      throw new BusinessRuleViolationError('REQUEST_ID_REQUIRED', 'A creation request ID is required')
    const base = this.baseService
    const scope = await schoolCommandScope(base.actor, `createHuman:${group}`, requestId)
    const key = group === 'staff' ? 'staffMembers' : group
    const id = input.id ?? randomUUID()
    return base.commandExecution.execute({
      scope,
      input,
      resultMode: 'ordinary',
      authorize: () => base.access.identities.assertCreateHuman(group),
      execute: () => write({ ...input, id }),
      persistResult: () => ({ id }),
      replay: async (stored) => {
        const entity = await base.entities[key].findById(stored.id)
        if (!entity)
          throw new BusinessRuleViolationError('COMMAND_REPLAY_CONFLICT', 'The created profile is no longer available')
        return entity as R
      },
      audit: () => [{ event: 'human-created', resourceType: key, resourceId: id }],
    })
  }

  protected async allocateNewEntityId(
    findById: (id: string) => Promise<unknown | undefined>,
    requestedId: string | undefined,
    errorCode: string,
    entityLabel: string,
  ): Promise<string> {
    const id = requestedId?.trim() || randomUUID()
    if (await findById(id)) {
      throw new BusinessRuleViolationError(errorCode, `${entityLabel} id ${id} already exists`)
    }
    return id
  }

  protected checkActorSchool(schoolId: string): void {
    if (schoolId !== requireActorSchoolId(this.baseService.actor))
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }

  protected async requireStudent(studentId: string): Promise<Student> {
    const student = await this.baseService.repositories.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  protected async requirePeriod(periodId: string): Promise<AcademicPeriod> {
    const period = await this.baseService.repositories.academicPeriods.findById(periodId)
    if (!period) {
      throw new BusinessRuleViolationError('UNKNOWN_PERIOD', `Unknown period: ${periodId}`)
    }
    return period
  }

  protected async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.baseService.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }
}
