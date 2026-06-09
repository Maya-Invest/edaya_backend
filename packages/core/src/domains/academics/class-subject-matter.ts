import type { AuthorizationPolicy } from '../../authorization'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../services/managed-entity-service'
import type { EntityConfigFactory } from '../../shared'
import { Permission } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { config, indirectTenant, noopDeleteAccess, noopReadAccess, noopSaveAccess, permissionAction, read, resolveClassSubjectSchoolId, write } from '../../shared'
import { requireNonBlank, requireNonNegativeNumber, requireOptionalNonBlank, requireValidDate } from '../utils'

export enum ClassSubjectMatterStatus {
  NotStarted = 'not_started',
  InProgress = 'in_progress',
  Completed = 'completed',
}

export interface ClassSubjectMatterArgs {
  id: string
  classSubjectId: string
  subjectMatterId: string
  status: ClassSubjectMatterStatus
  completedPercentage: number
  updatedByStaffId?: string | null
  startedAt?: Date | null
  completedAt?: Date | null
  notes?: string | null
  updatedAt?: Date
}

export class ClassSubjectMatter {
  readonly id: string
  readonly classSubjectId: string
  readonly subjectMatterId: string
  readonly status: ClassSubjectMatterStatus
  readonly completedPercentage: number
  readonly updatedByStaffId?: string
  readonly startedAt?: Date
  readonly completedAt?: Date
  readonly notes?: string
  readonly updatedAt: Date

  constructor({
    id,
    classSubjectId,
    subjectMatterId,
    status,
    completedPercentage,
    updatedByStaffId,
    startedAt,
    completedAt,
    notes,
    updatedAt,
  }: ClassSubjectMatterArgs) {
    this.id = requireNonBlank(id, 'id')
    this.classSubjectId = requireNonBlank(classSubjectId, 'classSubjectId')
    this.subjectMatterId = requireNonBlank(subjectMatterId, 'subjectMatterId')
    this.status = status
    this.completedPercentage = requireNonNegativeNumber(completedPercentage, 'completedPercentage')
    this.updatedByStaffId = requireOptionalNonBlank(updatedByStaffId, 'updatedByStaffId')
    this.startedAt = startedAt ? requireValidDate(startedAt, 'startedAt') : undefined
    this.completedAt = completedAt ? requireValidDate(completedAt, 'completedAt') : undefined
    this.notes = requireOptionalNonBlank(notes, 'notes')
    this.updatedAt = updatedAt ?? new Date()

    if (this.completedPercentage < 0 || this.completedPercentage > 100) {
      throw new Error('completedPercentage must be between 0 and 100')
    }
  }
}

export const classSubjectMatterConfig: EntityConfigFactory<ClassSubjectMatter> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.classSubjectMatters,
    tenant: classSubjectMatterTenant(),
    read: read(permissionAction(policy, Permission.QUERY_CLASS_CURRICULUM_READ), noopReadAccess),
    write: write(permissionAction(policy, Permission.ACADEMIC_PROGRAM_UPDATE), authorizeClassSubjectMatter(policy), authorizeClassSubjectMatterDelete(policy)),
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
