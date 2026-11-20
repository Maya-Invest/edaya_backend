import type { Guardian, StaffManualPermissionAssignmentInput, StaffMember, StaffPermissionProfile, Student, Teacher, UserScopeSelection } from '@edaya/core'
import type { PermissionResolutionReport } from '../../capabilities/access-control/resolve-staff-profile-grants'
import type { BaseSchoolService } from '../base-school-service'
import type { AccessControlWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { randomUUID } from 'node:crypto'
import { BusinessRuleViolationError, corePermissionDefinition, findPublishedAcademicYear, grantScopesEquivalent, StaffManualPermissionAssignment as StaffManualPermissionAssignmentEntity, StaffPermissionProfileBinding as StaffPermissionProfileBindingEntity, StaffPermissionProfile as StaffPermissionProfileEntity, StaffPermissionScopeDefaults as StaffPermissionScopeDefaultsEntity, validatePermissionScopes, withShortName } from '@edaya/core'

import { planStaffPermissionGrants, resolveStaffProfileGrants, validateScopeSelections } from '../../capabilities/access-control/resolve-staff-profile-grants'
import { linkSubjectToActor, relinkSubjectToActor, unlinkSubjectFromActor } from '../account-linking/link-subject-to-actor'

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

export interface ConfigurePermissionProfileInput {
  id: string
  schoolId?: string
  name: string
  shortName?: string
  description?: string
  previewOnly?: boolean
  permissions: StaffPermissionProfile['permissions']
}

export interface ApplyStaffPermissionProfileInput {
  staffId: string
  profileId: string
  academicYearId?: string
  customScopes: readonly UserScopeSelection[]
  useDefaultScopes: boolean
  previewOnly?: boolean
}

export interface ReorderStaffPermissionProfilesInput {
  academicYearId: string
  staffId: string
  profileIds: readonly string[]
}

export interface RemoveStaffPermissionProfileInput {
  academicYearId: string
  staffId: string
  profileId: string
}

export type AssignStaffPermissionInput = StaffManualPermissionAssignmentInput & { previewOnly?: boolean }
export interface ConfigureStaffPermissionScopeDefaultsInput {
  staffId: string
  academicYearId: string
  scopes: readonly UserScopeSelection[]
  previewOnly?: boolean
}

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
      await this.baseService.access.staffPermissions.assertAssign()
      return relinkSubjectToActor(
        this.baseService,
        this.repositories,
        this.baseService.actor.schoolId,
        input,
      )
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

  private permissionLock() {
    return { lockKeys: [`permission-state:${this.baseService.actor.schoolId}`] }
  }

  private async staffYear(staffId: string, requestedYear?: string) {
    const staff = await this.repositories.staffMembers.findById(staffId)
    if (!staff)
      throw new BusinessRuleViolationError('UNKNOWN_STAFF', `Unknown staff: ${staffId}`)
    this.checkActorSchool(staff.schoolId)
    await this.baseService.access.assertStaffAdministrationTarget(staffId)
    const academicYearId = requestedYear ?? (await findPublishedAcademicYear(this.repositories.academicYears, staff.schoolId))?.id
    if (!academicYearId)
      throw new BusinessRuleViolationError('STAFF_PROFILE_ACADEMIC_YEAR_REQUIRED', 'An academic year is required')
    await validateScopeSelections(this.baseService.repositories, staff.schoolId, academicYearId, [])
    return { staff, academicYearId }
  }

  async assignStaffPermission(input: AssignStaffPermissionInput) {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const { staff, academicYearId } = await this.staffYear(input.staffId, input.academicYearId)
      this.checkActorSchool(input.schoolId)
      const existing = await this.repositories.staffManualPermissionAssignments.findById(input.id)
      if (existing && (existing.staffId !== staff.id || existing.schoolId !== staff.schoolId || existing.academicYearId !== academicYearId))
        throw new BusinessRuleViolationError('PERMISSION_ASSIGNMENT_TARGET_LOCKED', 'An existing assignment cannot be moved to another staff member or year')
      if (await this.repositories.staffPermissionAssignments.findById(input.id))
        throw new BusinessRuleViolationError('PROFILE_BOUND_GRANT_LOCKED', 'Generated grants cannot be edited directly')
      const assignment = new StaffManualPermissionAssignmentEntity({ ...input, schoolId: staff.schoolId, academicYearId, createdAt: existing?.createdAt, updatedAt: new Date() })
      if (!corePermissionDefinition(assignment.permission).staffAssignable)
        throw new BusinessRuleViolationError('PERMISSION_SCOPE_INVALID', 'Platform actions cannot be staff permissions')
      for (const scope of assignment.customScopes) validatePermissionScopes(assignment.permission, [scope])
      await validateScopeSelections(this.baseService.repositories, staff.schoolId, academicYearId, assignment.customScopes)
      const args = { actor: this.baseService.actor, repositories: this.baseService.repositories, staffId: staff.id, academicYearId, manual: assignment }
      const plan = await planStaffPermissionGrants(args)
      const own = plan.desired.find(grant => grant.sourceManualAssignmentId === assignment.id)
      if (own && plan.desired.some(grant => grant.sourceProfileId && grant.permission === own.permission && grantScopesEquivalent(grant.scopes, own.scopes)))
        throw new BusinessRuleViolationError('PROFILE_GRANT_DUPLICATE', 'A profile already grants this permission with the same scopes')
      if (input.previewOnly)
        return { ...assignment.data, resolution: plan.report }
      await this.repositories.staffManualPermissionAssignments.save(assignment)
      const resolution = await resolveStaffProfileGrants(args)
      const saved = await this.repositories.staffManualPermissionAssignments.findById(assignment.id)
      return { ...saved!.data, resolution }
    }, this.permissionLock())
  }

  async configureStaffPermissionScopeDefaults(input: ConfigureStaffPermissionScopeDefaultsInput) {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const { staff, academicYearId } = await this.staffYear(input.staffId, input.academicYearId)
      const existing = await this.repositories.staffPermissionScopeDefaults.findOne({ staffId: staff.id, academicYearId })
      const defaults = new StaffPermissionScopeDefaultsEntity({ id: existing?.id ?? randomUUID(), schoolId: staff.schoolId, staffId: staff.id, academicYearId, scopes: [...input.scopes], createdAt: existing?.createdAt, updatedAt: new Date() })
      await validateScopeSelections(this.baseService.repositories, staff.schoolId, academicYearId, defaults.scopes)
      const args = { actor: this.baseService.actor, repositories: this.baseService.repositories, staffId: staff.id, academicYearId, defaults }
      if (input.previewOnly)
        return { ...defaults.data, resolution: (await planStaffPermissionGrants(args)).report }
      await this.repositories.staffPermissionScopeDefaults.save(defaults)
      return { ...defaults.data, resolution: await resolveStaffProfileGrants(args) }
    }, this.permissionLock())
  }

  async configurePermissionProfile(input: ConfigurePermissionProfileInput) {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertConfigure()
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      const existing = await this.repositories.staffPermissionProfiles.findById(input.id)
      if (existing && existing.schoolId !== schoolId)
        throw new BusinessRuleViolationError('PERMISSION_PROFILE_SCHOOL_MISMATCH', 'Permission profile belongs to a different school')
      const profile = new StaffPermissionProfileEntity(withShortName({ id: input.id, schoolId, name: input.name, shortName: input.shortName ?? existing?.shortName, description: input.description, permissions: input.permissions, sourceKey: existing?.sourceKey, createdAt: existing?.createdAt, updatedAt: new Date() }))
      const bindings = await this.repositories.staffPermissionProfileBindings.list({ profileId: profile.id })
      const staffIds = [...new Set(bindings.map(binding => binding.staffId))]
      const args = (staffId: string) => ({ actor: this.baseService.actor, repositories: this.baseService.repositories, staffId, profile })
      const resolution: PermissionResolutionReport = { changes: [], warnings: [] }
      if (!input.previewOnly)
        await this.repositories.staffPermissionProfiles.save(profile)
      for (const staffId of staffIds) {
        await this.baseService.access.assertStaffAdministrationTarget(staffId)
        const report = input.previewOnly ? (await planStaffPermissionGrants(args(staffId))).report : await resolveStaffProfileGrants(args(staffId))
        resolution.changes.push(...report.changes)
        resolution.warnings.push(...report.warnings)
      }
      return { ...profile.data, resolution }
    }, this.permissionLock())
  }

  async applyStaffPermissionProfile(input: ApplyStaffPermissionProfileInput) {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const { staff, academicYearId } = await this.staffYear(input.staffId, input.academicYearId)
      const profile = await this.repositories.staffPermissionProfiles.findById(input.profileId)
      if (!profile || profile.schoolId !== staff.schoolId)
        throw new BusinessRuleViolationError('UNKNOWN_PERMISSION_PROFILE', `Unknown permission profile: ${input.profileId}`)
      const existing = await this.repositories.staffPermissionProfileBindings.findOne({ staffId: staff.id, profileId: profile.id, academicYearId })
      const yearBindings = await this.repositories.staffPermissionProfileBindings.list({ staffId: staff.id, academicYearId })
      const binding = new StaffPermissionProfileBindingEntity({ id: existing?.id ?? randomUUID(), schoolId: staff.schoolId, staffId: staff.id, profileId: profile.id, academicYearId, customScopes: [...input.customScopes], useDefaultScopes: input.useDefaultScopes, sortOrder: existing?.sortOrder ?? Math.max(-1, ...yearBindings.map(row => row.sortOrder)) + 1, createdAt: existing?.createdAt, updatedAt: new Date() })
      await validateScopeSelections(this.baseService.repositories, staff.schoolId, academicYearId, binding.customScopes)
      const args = { actor: this.baseService.actor, repositories: this.baseService.repositories, staffId: staff.id, academicYearId, binding }
      if (input.previewOnly)
        return { ...binding.data, resolution: (await planStaffPermissionGrants(args)).report }
      await this.repositories.staffPermissionProfileBindings.save(binding)
      const resolution = await resolveStaffProfileGrants(args)
      const saved = await this.repositories.staffPermissionProfileBindings.findById(binding.id)
      return { ...saved!.data, resolution }
    }, this.permissionLock())
  }

  async reorderStaffPermissionProfiles(input: ReorderStaffPermissionProfilesInput) {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const { staff, academicYearId } = await this.staffYear(input.staffId, input.academicYearId)
      const bindings = await this.repositories.staffPermissionProfileBindings.list({ staffId: staff.id, academicYearId })
      const byProfile = new Map(bindings.map(binding => [binding.profileId, binding]))
      if (input.profileIds.length !== bindings.length || new Set(input.profileIds).size !== input.profileIds.length
        || input.profileIds.some(id => !byProfile.has(id))) {
        throw new BusinessRuleViolationError('PERMISSION_PROFILE_REORDER_MISMATCH', 'Reorder must list each assigned profile exactly once for this year')
      }
      for (const [index, id] of input.profileIds.entries()) {
        await this.repositories.staffPermissionProfileBindings.save(new StaffPermissionProfileBindingEntity({
          ...byProfile.get(id)!.data,
          sortOrder: index + 10000,
          updatedAt: new Date(),
        }))
      }
      for (const [index, id] of input.profileIds.entries()) {
        await this.repositories.staffPermissionProfileBindings.save(new StaffPermissionProfileBindingEntity({
          ...byProfile.get(id)!.data,
          sortOrder: index,
          updatedAt: new Date(),
        }))
      }
      const resolution = await resolveStaffProfileGrants({ actor: this.baseService.actor, repositories: this.baseService.repositories, staffId: staff.id, academicYearId })
      return { bindings: (await this.repositories.staffPermissionProfileBindings.list({ staffId: staff.id, academicYearId })).map(row => row.data), resolution }
    }, this.permissionLock())
  }

  async removeStaffPermissionProfile(input: RemoveStaffPermissionProfileInput) {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const { staff, academicYearId } = await this.staffYear(input.staffId, input.academicYearId)
      const binding = await this.repositories.staffPermissionProfileBindings.findOne({ staffId: staff.id, profileId: input.profileId, academicYearId })
      if (!binding)
        throw new BusinessRuleViolationError('UNKNOWN_PERMISSION_PROFILE_BINDING', 'This staff member does not have that permission profile in this year')
      await this.repositories.staffPermissionProfileBindings.delete(binding.id)
      return { staffId: staff.id, profileId: input.profileId, resolution: await resolveStaffProfileGrants({
        actor: this.baseService.actor,
        repositories: this.baseService.repositories,
        staffId: staff.id,
        academicYearId,
      }) }
    }, this.permissionLock())
  }

  async removeStaffPermission(input: { assignmentId: string }) {
    return this.baseService.atomicExecution.execute(async () => {
      await this.baseService.access.staffPermissions.assertAssign()
      const assignment = await this.repositories.staffManualPermissionAssignments.findById(input.assignmentId)
      if (!assignment)
        throw new BusinessRuleViolationError('UNKNOWN_PERMISSION_ASSIGNMENT', 'Unknown manual permission assignment')
      this.checkActorSchool(assignment.schoolId)
      await this.baseService.access.assertStaffAdministrationTarget(assignment.staffId)
      await this.repositories.staffManualPermissionAssignments.delete(assignment.id)
      return { assignmentId: assignment.id, resolution: await resolveStaffProfileGrants({ actor: this.baseService.actor, repositories: this.baseService.repositories, staffId: assignment.staffId, academicYearId: assignment.academicYearId }) }
    }, this.permissionLock())
  }
}
