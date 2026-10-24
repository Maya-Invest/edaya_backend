import type { CoreEntityKey, ImportApproval, ImportBatch, ImportType } from '@edaya/core'
import type { ActorAssuranceLevel, StaffActorMetadata } from '../model/actor'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import type { AccessPolicies } from './access-policies'
import { Permission } from '@edaya/core'
import { createStaffActorMetadata } from '../model/actor'
import { denied } from './facts'

export const importResources: Record<ImportType, CoreEntityKey> = {
  academic_disciplines: 'academicDisciplines',
  placement_statuses: 'placementStatuses',
  classes: 'classGroups',
  subjects: 'subjects',
  students: 'students',
  guardians: 'guardians',
  teachers: 'teachers',
  staff: 'staffMembers',
  guardian_contacts: 'guardians',
  guardian_relationships: 'guardianLinks',
  class_offerings: 'classSubjects',
  teacher_assignments: 'teacherAssignments',
  chapters: 'subjectMatters',
  billing: 'studentServiceEnrollments',
  payments: 'payments',
}
const importActions: Record<ImportType, Permission[]> = {
  academic_disciplines: [Permission.ACADEMIC_CATALOG_MANAGE],
  placement_statuses: [Permission.ACADEMIC_CATALOG_MANAGE],
  classes: [Permission.SCHOOL_CONFIGURE],
  subjects: [Permission.ACADEMIC_PROGRAM_MANAGE],
  students: [Permission.STUDENT_CREATE, Permission.STUDENT_MANAGE],
  guardians: [Permission.PARENT_MANAGE],
  teachers: [Permission.ACCESS_CONTROL_MANAGE],
  staff: [Permission.STAFF_MANAGE],
  guardian_contacts: [Permission.PARENT_MANAGE],
  guardian_relationships: [Permission.PARENT_MANAGE],
  class_offerings: [Permission.ACADEMIC_PROGRAM_MANAGE],
  teacher_assignments: [Permission.ACCESS_CONTROL_MANAGE],
  chapters: [Permission.ACADEMIC_PROGRAM_MANAGE],
  billing: [Permission.PAYMENT_RECORD],
  payments: [Permission.PAYMENT_RECORD],
}
export class ImportAccessPolicy {
  constructor(private readonly access: AccessPolicies) { }
  async assertSession(batch?: ImportBatch): Promise<StaffActorMetadata> {
    const actor = this.access.actor
    if (actor.kind !== 'staff' || actor.accountKind !== 'human')
      return denied('School imports require a human staff profile')
    if (batch && batch.schoolId !== actor.schoolId)
      return denied()
    await this.access.assertSchool(Permission.WORKSPACE_ACCESS)
    return actor
  }

  async assertType(type: ImportType, write = false): Promise<void> {
    await this.assertSession()
    await this.access.entity(importResources[type]).readScope()
    if (write)
      await this.access.scope(importActions[type], importResources[type], 'write', 'command')
  }

  /** Unmatched source evidence is disclosed only to its uploader while still authorized to import that type. */
  async assertUnmatchedRead(batch: ImportBatch, type: ImportType): Promise<void> {
    const actor = await this.assertSession(batch)
    if (actor.staffMemberId !== batch.createdByStaffId || actor.subjectId !== batch.createdBySubjectId)
      return denied()
    await this.assertType(type, true)
  }
}
/** Reconstitute identity only; current grants, assignments and target scopes are resolved by ordinary policies. */
export async function resolveImportActor(repositories: AuthorizationRepositories, schoolId: string, academicYearId: string, approval: ImportApproval, requestId: string): Promise<StaffActorMetadata> {
  const staff = await repositories.staffMembers.findById(approval.staffMemberId)
  if (!staff || staff.schoolId !== schoolId || !staff.isActive || staff.accountKind !== 'human' || staff.subjectId !== approval.subjectId)
    return denied('Import initiating authority is no longer valid')
  return createStaffActorMetadata({ schoolId, academicYearId, staffMemberId: staff.id, subjectId: approval.subjectId, requestId, authenticatedAt: new Date(approval.authenticatedAt), assuranceLevel: approval.assuranceLevel as ActorAssuranceLevel })
}
