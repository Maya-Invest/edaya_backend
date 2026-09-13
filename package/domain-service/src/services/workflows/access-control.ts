import type { Guardian, StaffMember, StaffPermissionAssignment, StaffPermissionAssignmentInput, Student, Teacher } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { AccessControlWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BusinessRuleViolationError, StaffPermissionAssignment as StaffPermissionAssignmentEntity } from '@edaya/core'

import { linkSubjectToActor, unlinkSubjectFromActor } from '../account-linking/link-subject-to-actor'

import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface LinkActorSubjectInput {
  subjectId: string
  staffMemberId?: string
  guardianId?: string
  studentId?: string
  teacherId?: string
}

export type LinkActorSubjectResult
  = | { kind: 'staff', entity: StaffMember }
    | { kind: 'guardian', entity: Guardian }
    | { kind: 'student', entity: Student }
    | { kind: 'teacher', entity: Teacher }

export class AccessControlServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: AccessControlWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('accessControl', base.repositories)
  }

  async linkActorSubject(input: LinkActorSubjectInput): Promise<LinkActorSubjectResult> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()

      const targetCount = [input.staffMemberId, input.guardianId, input.studentId, input.teacherId].filter(Boolean).length
      if (targetCount !== 1) {
        throw new BusinessRuleViolationError(
          'LINK_ACTOR_SUBJECT_AMBIGUOUS',
          'Exactly one of staffMemberId, guardianId, studentId, or teacherId is required',
        )
      }

      return linkSubjectToActor(
        this.baseService,
        this.repositories,
        this.baseService.actor.schoolId,
        input,
      )
    })
  }

  async relinkActorSubject(input: LinkActorSubjectInput): Promise<LinkActorSubjectResult> {
    return this.baseService.atomicExecution.execute(async () => {
      return this.linkActorSubject(input)
    })
  }

  async unlinkActorSubject(input: Omit<LinkActorSubjectInput, 'subjectId'>): Promise<LinkActorSubjectResult> {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()

      const targetCount = [input.staffMemberId, input.guardianId, input.studentId, input.teacherId].filter(Boolean).length
      if (targetCount !== 1) {
        throw new BusinessRuleViolationError(
          'LINK_ACTOR_SUBJECT_AMBIGUOUS',
          'Exactly one of staffMemberId, guardianId, studentId, or teacherId is required',
        )
      }

      return unlinkSubjectFromActor(
        this.baseService,
        this.repositories,
        this.baseService.actor.schoolId,
        input,
      )
    })
  }

  async assignStaffPermission(input: StaffPermissionAssignmentInput): Promise<StaffPermissionAssignment> {
    return this.baseService.atomicExecution.execute(async () => {
      const assignment = new StaffPermissionAssignmentEntity(input)
      this.checkActorSchool(assignment.schoolId)
      await this.baseService.entities.staffPermissionAssignments.save(assignment)
      return assignment
    })
  }
}
