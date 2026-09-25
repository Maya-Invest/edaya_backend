import type { GrantScope, Guardian, StaffMember, StaffPermissionAssignment, StaffPermissionAssignmentInput, StaffPermissionProfile, StaffPermissionProfileBinding, Student, Teacher } from '@edaya/core'
import type { BaseSchoolService } from '../base-school-service'
import type { AccessControlWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { randomUUID } from 'node:crypto'
import { BusinessRuleViolationError, defaultScopesForProfileGrain, findPublishedAcademicYear, permissionMatchesProfileGrain, StaffPermissionAssignment as StaffPermissionAssignmentEntity, StaffPermissionProfileBinding as StaffPermissionProfileBindingEntity, StaffPermissionProfile as StaffPermissionProfileEntity, validatePermissionScopes, validateProfileBindingScopes } from '@edaya/core'

import { resolveStaffProfileGrants } from '../../capabilities/access-control/resolve-staff-profile-grants'
import { ensureSchoolPermissionProfiles } from '../../capabilities/access-control/seed-staff-permission-profiles'
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
  description?: string
  scopeGrain: StaffPermissionProfile['scopeGrain']
  permissions: StaffPermissionProfile['permissions']
}

export interface ApplyStaffPermissionProfileInput {
  staffId: string
  profileId: string
  academicYearId?: string
  scopes: readonly GrantScope[]
}

export interface ReorderStaffPermissionProfilesInput {
  staffId: string
  profileIds: readonly string[]
}

export interface RemoveStaffPermissionProfileInput {
  staffId: string
  profileId: string
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

  async assignStaffPermission(input: StaffPermissionAssignmentInput): Promise<StaffPermissionAssignment> {
    return this.baseService.atomicExecution.execute(async () => {
      const assignment = new StaffPermissionAssignmentEntity({ ...input, sourceProfileId: undefined })
      this.checkActorSchool(assignment.schoolId)
      await this.baseService.entities.staffPermissionAssignments.save(assignment)
      return assignment
    })
  }

  async configurePermissionProfile(input: ConfigurePermissionProfileInput): Promise<StaffPermissionProfile> {
    await this.baseService.access.staffPermissions.assertConfigure()
    return this.baseService.atomicExecution.execute(async () => {
      const schoolId = input.schoolId ?? this.baseService.actor.schoolId
      this.checkActorSchool(schoolId)
      await ensureSchoolPermissionProfiles(this.repositories, schoolId)

      const existing = await this.repositories.staffPermissionProfiles.findById(input.id)
      if (existing && existing.schoolId !== schoolId) {
        throw new BusinessRuleViolationError(
          'PERMISSION_PROFILE_SCHOOL_MISMATCH',
          'Permission profile belongs to a different school',
        )
      }

      const bindings = await this.repositories.staffPermissionProfileBindings.list({ profileId: input.id })
      if (existing && bindings.length > 0 && input.scopeGrain !== existing.scopeGrain) {
        throw new BusinessRuleViolationError(
          'PERMISSION_PROFILE_SCOPE_LOCKED',
          `Remove this profile from ${bindings.length} staff first`,
        )
      }

      const mismatched = input.permissions.filter(permission => !permissionMatchesProfileGrain(permission, input.scopeGrain))
      const grainChanged = Boolean(existing && existing.scopeGrain !== input.scopeGrain)
      if (mismatched.length && !grainChanged) {
        throw new BusinessRuleViolationError(
          'PERMISSION_PROFILE_MIXED_GRAIN',
          'A profile can only include permissions that share its scope grain',
        )
      }

      const now = new Date()
      const profile = new StaffPermissionProfileEntity({
        id: input.id,
        schoolId,
        name: input.name,
        description: input.description,
        scopeGrain: input.scopeGrain,
        permissions: input.permissions.filter(permission => permissionMatchesProfileGrain(permission, input.scopeGrain)),
        sourceKey: existing?.sourceKey,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      await this.repositories.staffPermissionProfiles.save(profile)

      const staffIds = [...new Set(bindings.map(binding => binding.staffId))]
      for (const staffId of staffIds) {
        await resolveStaffProfileGrants({
          actor: this.baseService.actor,
          repositories: this.baseService.repositories,
          staffId,
        })
      }
      return profile
    })
  }

  async applyStaffPermissionProfile(input: ApplyStaffPermissionProfileInput): Promise<StaffPermissionProfileBinding> {
    await this.baseService.access.staffPermissions.assertAssign()
    await this.baseService.access.assertStaffAdministrationTarget(input.staffId)
    return this.baseService.atomicExecution.execute(async () => {
      const staff = await this.repositories.staffMembers.findById(input.staffId)
      if (!staff) {
        throw new BusinessRuleViolationError('UNKNOWN_STAFF', `Unknown staff: ${input.staffId}`)
      }
      this.checkActorSchool(staff.schoolId)
      await ensureSchoolPermissionProfiles(this.repositories, staff.schoolId)

      const profile = await this.repositories.staffPermissionProfiles.findById(input.profileId)
      if (!profile || profile.schoolId !== staff.schoolId) {
        throw new BusinessRuleViolationError(
          'UNKNOWN_PERMISSION_PROFILE',
          `Unknown permission profile: ${input.profileId}`,
        )
      }

      const academicYearId = input.academicYearId
        ?? (await findPublishedAcademicYear(this.repositories.academicYears, staff.schoolId))?.id
      if (!academicYearId) {
        throw new BusinessRuleViolationError(
          'STAFF_PROFILE_ACADEMIC_YEAR_REQUIRED',
          'An academic year is required to apply a permission profile',
        )
      }

      const scopes = profile.scopeGrain === 'school'
        ? defaultScopesForProfileGrain('school')
        : [...input.scopes]
      try {
        validateProfileBindingScopes(profile.scopeGrain, scopes)
        for (const permission of profile.permissions)
          validatePermissionScopes(permission, scopes)
      }
      catch (error) {
        throw new BusinessRuleViolationError(
          'PERMISSION_PROFILE_SCOPE_INVALID',
          error instanceof Error ? error.message : 'Invalid profile scopes',
        )
      }

      const existing = await this.repositories.staffPermissionProfileBindings.findOne({
        staffId: input.staffId,
        profileId: input.profileId,
      })
      const yearBindings = await this.repositories.staffPermissionProfileBindings.list({
        staffId: input.staffId,
        academicYearId,
      })
      const sortOrder = existing && existing.academicYearId === academicYearId
        ? existing.sortOrder
        : Math.max(-1, ...yearBindings.filter(binding => binding.id !== existing?.id).map(binding => binding.sortOrder)) + 1

      const now = new Date()
      const binding = new StaffPermissionProfileBindingEntity({
        id: existing?.id ?? randomUUID(),
        schoolId: staff.schoolId,
        staffId: input.staffId,
        profileId: input.profileId,
        academicYearId,
        scopes,
        sortOrder,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      })
      await this.repositories.staffPermissionProfileBindings.save(binding)
      await resolveStaffProfileGrants({
        actor: this.baseService.actor,
        repositories: this.baseService.repositories,
        staffId: input.staffId,
      })
      return binding
    })
  }

  async reorderStaffPermissionProfiles(input: ReorderStaffPermissionProfilesInput): Promise<StaffPermissionProfileBinding[]> {
    await this.baseService.access.staffPermissions.assertAssign()
    await this.baseService.access.assertStaffAdministrationTarget(input.staffId)
    return this.baseService.atomicExecution.execute(async () => {
      const bindings = await this.repositories.staffPermissionProfileBindings.list({ staffId: input.staffId })
      const byProfile = new Map(bindings.map(binding => [binding.profileId, binding]))
      if (
        input.profileIds.length !== bindings.length
        || new Set(input.profileIds).size !== input.profileIds.length
        || input.profileIds.some(profileId => !byProfile.has(profileId))
      ) {
        throw new BusinessRuleViolationError(
          'PERMISSION_PROFILE_REORDER_MISMATCH',
          'Reorder must list each assigned profile exactly once',
        )
      }

      const now = new Date()
      const updated: StaffPermissionProfileBinding[] = []
      for (const [index, profileId] of input.profileIds.entries()) {
        const binding = byProfile.get(profileId)!
        await this.repositories.staffPermissionProfileBindings.save(new StaffPermissionProfileBindingEntity({
          ...binding.data,
          sortOrder: index + 10_000,
          updatedAt: now,
        }))
      }
      for (const [index, profileId] of input.profileIds.entries()) {
        const binding = byProfile.get(profileId)!
        const next = new StaffPermissionProfileBindingEntity({
          ...binding.data,
          sortOrder: index,
          updatedAt: now,
        })
        await this.repositories.staffPermissionProfileBindings.save(next)
        updated.push(next)
      }

      await resolveStaffProfileGrants({
        actor: this.baseService.actor,
        repositories: this.baseService.repositories,
        staffId: input.staffId,
      })
      return updated
    })
  }

  async removeStaffPermissionProfile(input: RemoveStaffPermissionProfileInput): Promise<{ staffId: string, profileId: string }> {
    await this.baseService.access.staffPermissions.assertAssign()
    await this.baseService.access.assertStaffAdministrationTarget(input.staffId)
    return this.baseService.atomicExecution.execute(async () => {
      const binding = await this.repositories.staffPermissionProfileBindings.findOne({
        staffId: input.staffId,
        profileId: input.profileId,
      })
      if (!binding) {
        throw new BusinessRuleViolationError(
          'UNKNOWN_PERMISSION_PROFILE_BINDING',
          'This staff member does not have that permission profile',
        )
      }
      this.checkActorSchool(binding.schoolId)
      await this.repositories.staffPermissionProfileBindings.delete(binding.id)
      await resolveStaffProfileGrants({
        actor: this.baseService.actor,
        repositories: this.baseService.repositories,
        staffId: input.staffId,
      })
      return { staffId: input.staffId, profileId: input.profileId }
    })
  }
}
