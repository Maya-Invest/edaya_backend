import type { Session } from '../../../entities/scheduling/session'
import type { Attachment, AttachmentOwnerKind } from '../../../entities/school/attachment'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { Resource } from '../../../entities/school/resource'
import type { ResourceAssignment } from '../../../entities/school/resource-assignment'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { denyResourceAccess } from '../../authorization'
import { resolveAttachmentOwnerContext } from './attachment-resolver'

export interface ResourceAssignmentDetail {
  assignment: ResourceAssignment
  resource: Resource
  classGroup?: ClassGroup
  session?: Session
}

export interface ResourceDirectory {
  resources: Resource[]
  assignments: ResourceAssignmentDetail[]
}

export interface AttachmentDirectory {
  attachments: Attachment[]
}

export class ResourceReadService {
  constructor(args: ServiceArgs) {
    this.resources = args.repositories.resources
    this.resourceAssignments = args.repositories.resourceAssignments
    this.classGroups = args.repositories.classGroups
    this.sessions = args.repositories.sessions
  }

  private readonly resources: SchoolRepositories['resources']
  private readonly resourceAssignments: SchoolRepositories['resourceAssignments']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly sessions: SchoolRepositories['sessions']

  async listResources({ schoolId }: { schoolId: string }): Promise<ResourceDirectory> {
    const resources = (await this.resources.list({ schoolId }))
      .sort((left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id))
    const resourceIds = new Set(resources.map(resource => resource.id))
    const assignments = (await this.resourceAssignments.list())
      .filter(assignment => resourceIds.has(assignment.resourceId))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return {
      resources,
      assignments: await Promise.all(assignments.map(assignment => this.buildAssignmentDetail(assignment))),
    }
  }

  private async buildAssignmentDetail(assignment: ResourceAssignment): Promise<ResourceAssignmentDetail> {
    const resource = await this.resources.findById(assignment.resourceId)
    if (!resource) {
      denyResourceAccess()
    }
    const classGroup = assignment.classGroupId
      ? await this.classGroups.findById(assignment.classGroupId)
      : undefined
    const session = assignment.sessionId
      ? await this.sessions.findById(assignment.sessionId)
      : undefined
    if ((assignment.classGroupId && (!classGroup || classGroup.schoolId !== resource.schoolId)) || (assignment.sessionId && !session)) {
      denyResourceAccess()
    }
    const sessionClassGroup = session ? await this.classGroups.findById(session.classGroupId) : undefined
    if (session && (!sessionClassGroup || sessionClassGroup.schoolId !== resource.schoolId)) {
      denyResourceAccess()
    }
    return { assignment, resource, classGroup: classGroup ?? sessionClassGroup, session }
  }
}

export class AttachmentReadService {
  constructor(args: ServiceArgs) {
    this.repositories = args.repositories
  }

  private readonly repositories: SchoolRepositories

  async listAttachments({
    schoolId,
    ownerKind,
    ownerId,
  }: {
    schoolId: string
    ownerKind: AttachmentOwnerKind
    ownerId: string
  }): Promise<AttachmentDirectory> {
    await resolveAttachmentOwnerContext(this.repositories, ownerKind, ownerId, schoolId)
    const attachments = (await this.repositories.attachments.list({ schoolId, ownerKind, ownerId }))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id))
    return { attachments }
  }
}
