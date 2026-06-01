import type {
  DisciplinaryAction,
  GradeLevel,
  PeriodDefinition,
  Resource,
  Subject,
  SubjectMatter,
} from '../../entities'
import type { BaseRepositoryInterface } from '../../ports'
import type { ActorMetadata } from '../authorization'
import type { ManagedEntityService } from '../entities'
import type { ServiceArgs } from '../shared/service-args'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization'
import { BaseSchoolService } from '../entities'

function checkEntityTenant(actor: ActorMetadata, entity: any) {
  if (!entity)
    return
  const entSchoolId = entity.schoolId ?? (entity.id && typeof entity.id === 'string' && (entity.constructor?.name === 'School' || ('timeZone' in entity && 'name' in entity)) ? entity.id : undefined)
  if (entSchoolId && entSchoolId !== actor.schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
}

export class AuthorizedWriteService<T> {
  constructor(
    private readonly repository: BaseRepositoryInterface<T>,
    private readonly actor: ActorMetadata,
    private readonly checkModule: (actor: ActorMetadata) => Promise<void>,
    private readonly checkAccess: (actor: ActorMetadata, ids: string[]) => Promise<void>,
    private readonly validate?: (entity: T) => Promise<void>,
  ) {}

  async save(entity: T): Promise<void> {
    await this.checkModule(this.actor)
    checkEntityTenant(this.actor, entity)
    if (this.validate) {
      await this.validate(entity)
    }

    if ((entity as any).id) {
      await this.checkAccess(this.actor, [(entity as any).id])
    }
    await this.repository.save(entity)
  }

  async delete(id: string): Promise<void> {
    await this.checkModule(this.actor)
    const entity = await this.repository.findById(id)
    if (entity) {
      checkEntityTenant(this.actor, entity)
      await this.checkAccess(this.actor, [id])
      await this.repository.delete(id)
    }
  }
}

export class ConfigService {
  public readonly gradeLevels: ManagedEntityService<GradeLevel>
  public readonly periodDefinitions: ManagedEntityService<PeriodDefinition>
  public readonly resources: ManagedEntityService<Resource>
  public readonly subjects: ManagedEntityService<Subject>
  public readonly subjectMatters: ManagedEntityService<SubjectMatter>
  public readonly disciplinaryActions: ManagedEntityService<DisciplinaryAction>

  constructor(args: ServiceArgs) {
    const base = new BaseSchoolService(args)
    this.gradeLevels = base.gradeLevels
    this.periodDefinitions = base.periodDefinitions
    this.resources = base.resources
    this.subjects = base.subjects
    this.subjectMatters = base.subjectMatters
    this.disciplinaryActions = base.disciplinaryActions
  }
}
