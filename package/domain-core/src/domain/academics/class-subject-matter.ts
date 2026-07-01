import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import { z } from 'zod'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, resolveClassSubjectSchoolId, write } from '../../application/entities/entity-config'
import { denyResourceAccess, Permission } from '../../capabilities/authorization'
import { parseDomain, zodDate } from '../shared/utils'

export enum ClassSubjectMatterStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
}

export const classSubjectMatterSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  classSubjectId: z.string().trim().min(1, 'classSubjectId must not be blank'),
  subjectMatterId: z.string().trim().min(1, 'subjectMatterId must not be blank'),
  status: z.nativeEnum(ClassSubjectMatterStatus),
  completedPercentage: z.preprocess(
    val => val === null ? undefined : val,
    z.number().min(0, 'completedPercentage must be between 0 and 100').max(100, 'completedPercentage must be between 0 and 100'),
  ),
  updatedByStaffId: z.string().trim().min(1, 'updatedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  startedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  completedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  updatedAt: zodDate().default(() => new Date()),
})

export type ClassSubjectMatterData = z.infer<typeof classSubjectMatterSchema>
export type ClassSubjectMatterInput = z.input<typeof classSubjectMatterSchema>

export const classSubjectMatterCreateSchema = classSubjectMatterSchema.omit({ updatedAt: true })
export const classSubjectMatterUpdateSchema = classSubjectMatterSchema.partial().required({ id: true })

export class ClassSubjectMatter {
  readonly data: ClassSubjectMatterData

  constructor(args: ClassSubjectMatterInput) {
    this.data = parseDomain(classSubjectMatterSchema, args)
  }

  get id() { return this.data.id }
  get classSubjectId() { return this.data.classSubjectId }
  get subjectMatterId() { return this.data.subjectMatterId }
  get status() { return this.data.status }
  get completedPercentage() { return this.data.completedPercentage }
  get updatedByStaffId() { return this.data.updatedByStaffId }
  get startedAt() { return this.data.startedAt }
  get completedAt() { return this.data.completedAt }
  get notes() { return this.data.notes }
  get updatedAt() { return this.data.updatedAt }
}

export const classSubjectMatterConfig: EntityConfigFactory<ClassSubjectMatter> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectMatters,
    tenant: classSubjectMatterTenant(),
    read: read(permissionAction(Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(Permission.ACADEMIC_PROGRAM_UPDATE), authorizeClassSubjectMatter(policy), authorizeClassSubjectMatterDelete(policy)),
    gates: {
      preSave: validateClassSubjectMatterSave,
    },
    atomicExecution,
  })

function classSubjectMatterTenant(): EntityTenantResolver<ClassSubjectMatter> {
  return indirectTenant(async (entity, repositories) => resolveClassSubjectSchoolId(repositories, entity.classSubjectId))
}

async function validateClassSubjectMatterSave(
  classSubjectMatter: ClassSubjectMatter,
  _existing: ClassSubjectMatter | undefined,
  repositories: SchoolRepositories,
): Promise<void> {
  if (!repositories.classSubjects || !repositories.subjectMatters) {
    return
  }
  const [classSubject, subjectMatter] = await Promise.all([
    repositories.classSubjects.findById(classSubjectMatter.classSubjectId),
    repositories.subjectMatters.findById(classSubjectMatter.subjectMatterId),
  ])
  if (!classSubject || !subjectMatter || subjectMatter.subjectId !== classSubject.subjectId) {
    denyResourceAccess()
  }
}

function authorizeClassSubjectMatter(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectMatter>['authorizeSave'] {
  return noopSaveAccess
}

function authorizeClassSubjectMatterDelete(_policy: AuthorizationPolicy): EntityWriteAuthorization<ClassSubjectMatter>['authorizeDelete'] {
  return noopDeleteAccess
}
