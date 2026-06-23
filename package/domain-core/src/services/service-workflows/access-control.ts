import type { Guardian, StaffMember, Student } from '../../domains'
import type { BaseSchoolService } from '../base-school-service'
import type { AccessControlWorkflowRepositories } from '../workflow-repository-catalog'
import { denyResourceAccess, Permission } from '../../authorization'
import { Guardian as GuardianEntity, StaffMember as StaffMemberEntity } from '../../domains'
import { permissionAction } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { pickWorkflowRepositories } from '../workflow-repository-catalog'
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

    await this.assertSubjectIdAvailable(input.subjectId, input)

    if (input.staffMemberId) {
      const existing = await this.requireStaffMemberInSchool(input.staffMemberId)
      this.assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
      const staffMember = new StaffMemberEntity({
        id: existing.id,
        schoolId: existing.schoolId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        subjectId: input.subjectId,
        isActive: existing.isActive,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.staffMembers.save(staffMember, { moduleChecked: true })
      return { kind: 'staff', entity: staffMember }
    }

    if (input.guardianId) {
      const existing = await this.requireGuardianInSchool(input.guardianId)
      this.assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
      const guardian = new GuardianEntity({
        id: existing.id,
        schoolId: existing.schoolId,
        firstName: existing.firstName,
        lastName: existing.lastName,
        email: existing.email,
        phone: existing.phone,
        subjectId: input.subjectId,
        contactMethods: [...existing.contactMethods],
        hasAccess: existing.hasAccess,
        premiumNotificationsEnabled: existing.premiumNotificationsEnabled,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.guardians.save(guardian, { moduleChecked: true })
      return { kind: 'guardian', entity: guardian }
    }

    const existing = await this.requireStudentInSchool(input.studentId!)
    this.assertEntitySubjectLinkable(existing.subjectId, input.subjectId)
    const student = existing.copyWith({ subjectId: input.subjectId })
    await this.baseService.entities.students.save(student, { moduleChecked: true })
    return { kind: 'student', entity: student }
  }

  private assertEntitySubjectLinkable(existingSubjectId: string | undefined, nextSubjectId: string): void {
    if (existingSubjectId && existingSubjectId !== nextSubjectId) {
      throw new BusinessRuleViolationError(
        'ACTOR_SUBJECT_ALREADY_LINKED',
        'The target entity is already linked to a different auth subject',
      )
    }
  }

  private async assertSubjectIdAvailable(
    subjectId: string,
    input: LinkActorSubjectInput,
  ): Promise<void> {
    const [staff, guardian, student] = await Promise.all([
      this.repositories.staffMembers.findOne({ subjectId }),
      this.repositories.guardians.findOne({ subjectId }),
      this.repositories.students.findOne({ subjectId }),
    ])

    const conflicts = [
      staff && staff.id !== input.staffMemberId ? { kind: 'staff' as const, id: staff.id } : null,
      guardian && guardian.id !== input.guardianId ? { kind: 'guardian' as const, id: guardian.id } : null,
      student && student.id !== input.studentId ? { kind: 'student' as const, id: student.id } : null,
    ].filter((entry): entry is { kind: 'staff' | 'guardian' | 'student', id: string } => entry !== null)

    if (conflicts.length > 0) {
      const [conflict] = conflicts
      throw new BusinessRuleViolationError(
        'SUBJECT_ID_ALREADY_LINKED',
        `Auth subject ${subjectId} is already linked to ${conflict?.kind} ${conflict?.id}`,
      )
    }
  }

  private async requireStaffMemberInSchool(staffMemberId: string): Promise<StaffMember> {
    const staffMember = await this.repositories.staffMembers.findById(staffMemberId)
    if (!staffMember || staffMember.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return staffMember
  }

  private async requireGuardianInSchool(guardianId: string): Promise<Guardian> {
    const guardian = await this.repositories.guardians.findById(guardianId)
    if (!guardian || guardian.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return guardian
  }

  private async requireStudentInSchool(studentId: string): Promise<Student> {
    const student = await this.repositories.students.findById(studentId)
    if (!student || student.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return student
  }
}
