import type { ResourceAssignment } from '$lib/core/entities/school/resource-assignment'
import type { BaseRepositoryInterface } from './_base-repository'

export interface ResourceAssignmentRepository extends BaseRepositoryInterface<ResourceAssignment> {
  listByResource: (resourceId: string) => Promise<ResourceAssignment[]>
  listByClassGroup: (classGroupId: string) => Promise<ResourceAssignment[]>
  listBySession: (sessionId: string) => Promise<ResourceAssignment[]>
  listByGroupedSession: (groupedSessionId: string) => Promise<ResourceAssignment[]>
}
