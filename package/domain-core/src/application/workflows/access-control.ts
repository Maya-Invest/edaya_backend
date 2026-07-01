import type { Guardian, StaffMember, Student } from '../../domain'
import type { BaseSchoolService } from '../base-school-service'
import type { AccessControlWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { Permission } from '../../capabilities/authorization'
import { permissionAction } from '../../application/entities/entity-config'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { linkSubjectToActor } from '../account-linking/link-subject-to-actor'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface LinkActorSubjectInput {
  subjectId: string
  staffMemberId?: string
  guardianId?: string
  studentId?: string
}

export type LinkActorSubjectResult
  = | { kind: 'staff', entity: StaffMember }
    | { kind: 'guardian', entity: Guardian }
    | { kind: 'student', entity: Student }

export class AccessControlServiceWorkflow extends BaseServiceWorkflow {
  private readonly repositories: AccessControlWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('accessControl', base.repositories)
  }

  async linkActorSubject(input: LinkActorSubjectInput): Promise<LinkActorSubjectResult> {
    await permissionAction(Permission.ACCESS_CONTROL_ASSIGN)(this.baseService.actor)

    const targetCount = [input.staffMemberId, input.guardianId, input.studentId].filter(Boolean).length
    if (targetCount !== 1) {
      throw new BusinessRuleViolationError(
        'LINK_ACTOR_SUBJECT_AMBIGUOUS',
        'Exactly one of staffMemberId, guardianId, or studentId is required',
      )
    }

    return linkSubjectToActor(
      this.baseService,
      this.repositories,
      this.baseService.actor.schoolId,
      input,
    )
  }
}

// Re-export notification upsert side effects remain inside linkSubjectToActor
