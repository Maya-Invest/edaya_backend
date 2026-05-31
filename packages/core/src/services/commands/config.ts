import type {
  DisciplinaryAction,
  GradeLevel,
  PeriodDefinition,
  Resource,
  Subject,
  SubjectMatter,
} from '../../entities'
import type { BaseRepositoryInterface, SchoolRepositories } from '../../ports'
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { ServiceArgs } from '../shared/service-args'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization'

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
  protected readonly repositories: SchoolRepositories
  protected readonly actor: ActorMetadata
  protected readonly authorizationPolicy: AuthorizationPolicy

  public readonly gradeLevels: AuthorizedWriteService<GradeLevel>
  public readonly periodDefinitions: AuthorizedWriteService<PeriodDefinition>
  public readonly resources: AuthorizedWriteService<Resource>
  public readonly subjects: AuthorizedWriteService<Subject>
  public readonly subjectMatters: AuthorizedWriteService<SubjectMatter>
  public readonly disciplinaryActions: AuthorizedWriteService<DisciplinaryAction>

  constructor(args: ServiceArgs) {
    this.repositories = args.repositories
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy

    // Expose write actions mapped to corresponding policies
    this.gradeLevels = new AuthorizedWriteService(
      this.repositories.gradeLevels,
      this.actor,
      async actor => this.authorizationPolicy.checkGlobalAction(actor, 'setup.manage'),
      async (actor, ids) => this.authorizationPolicy.checkClassGroupAccess(actor, ids),
    )

    this.periodDefinitions = new AuthorizedWriteService(
      this.repositories.periodDefinitions,
      this.actor,
      async actor => this.authorizationPolicy.checkGlobalAction(actor, 'setup.manage'),
      async () => {}, // Global configuration
    )

    this.resources = new AuthorizedWriteService(
      this.repositories.resources,
      this.actor,
      async actor => this.authorizationPolicy.checkGlobalAction(actor, 'resources.manage'),
      async () => {},
    )

    this.subjects = new AuthorizedWriteService(
      this.repositories.subjects,
      this.actor,
      async actor => this.authorizationPolicy.checkGlobalAction(actor, 'academics.manage_curriculum'),
      async () => {},
    )

    this.subjectMatters = new AuthorizedWriteService(
      this.repositories.subjectMatters,
      this.actor,
      async actor => this.authorizationPolicy.checkGlobalAction(actor, 'academics.manage_curriculum'),
      async () => {},
      async (entity) => {
        const subject = await this.repositories.subjects.findById(entity.subjectId)
        if (!subject || subject.schoolId !== this.actor.schoolId) {
          throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
        }
      },
    )

    this.disciplinaryActions = new AuthorizedWriteService(
      this.repositories.disciplinaryActions,
      this.actor,
      async actor => this.authorizationPolicy.checkGlobalAction(actor, 'behavior.manage_discipline'),
      async () => {},
    )
  }
}
