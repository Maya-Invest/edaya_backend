import type { SchoolScopedActorMetadata } from '@edaya/authorization'
import type { GrantScope, Permission, PermissionResolutionWarning, StaffManualPermissionAssignment, StaffPermissionProfile, StaffPermissionProfileBinding, StaffPermissionScopeDefaults } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { AccessFacts, assertGrantDelegation, validateGrantTargets } from '@edaya/authorization'
import { BusinessRuleViolationError, grantScopesEquivalent, StaffManualPermissionAssignment as ManualAssignment, StaffPermissionProfileBinding as ProfileBinding, scopesForPermission, StaffPermissionAssignment } from '@edaya/core'

export interface PermissionGrantChange {
  staffId: string
  staffName: string
  academicYearId: string
  permission: Permission
  change: 'added' | 'changed' | 'removed'
  beforeScopes: readonly GrantScope[]
  afterScopes: readonly GrantScope[]
}
export interface PermissionResolutionReport {
  changes: PermissionGrantChange[]
  warnings: (PermissionResolutionWarning & { staffId: string, staffName: string, academicYearId: string, assignmentId: string })[]
}
export interface StaffGrantPlanInput {
  actor?: SchoolScopedActorMetadata
  repositories: SchoolRepositories
  staffId: string
  academicYearId?: string
  profile?: StaffPermissionProfile
  binding?: StaffPermissionProfileBinding
  manual?: StaffManualPermissionAssignment
  defaults?: StaffPermissionScopeDefaults
  removedBindingId?: string
  removedManualId?: string
}

function grantsUnchanged(before: StaffPermissionAssignment, after: StaffPermissionAssignment) {
  return before.permission === after.permission && grantScopesEquivalent(before.scopes, after.scopes)
    && before.status === after.status && before.startsAt?.getTime() === after.startsAt?.getTime()
    && before.endsAt?.getTime() === after.endsAt?.getTime()
    && before.sourceProfileId === after.sourceProfileId
    && before.sourceProfileBindingId === after.sourceProfileBindingId
    && before.sourceManualAssignmentId === after.sourceManualAssignmentId
}

/** Validate saved references independently of the permission catalog. */
export async function scopeSelectionIsValid(repositories: SchoolRepositories, schoolId: string, academicYearId: string, scope: GrantScope): Promise<boolean> {
  const sameSchool = (entity: { schoolId?: string } | undefined) => Boolean(entity && (!entity.schoolId || entity.schoolId === schoolId))
  switch (scope.kind) {
    case 'school': case 'all': return true
    case 'student': return sameSchool(await repositories.students.findById(scope.studentId))
    case 'grade_level': return sameSchool(await repositories.gradeLevels.findById(scope.gradeLevelId))
    case 'subject': {
      if (!sameSchool(await repositories.gradeLevels.findById(scope.gradeLevelId)))
        return false
      if (scope.subjectId) {
        const subject = await repositories.subjects.findById(scope.subjectId)
        if (!subject || subject.schoolId !== schoolId || subject.gradeLevelId !== scope.gradeLevelId || subject.academicYearId !== academicYearId)
          return false
      }
      if (scope.classGroupId) {
        const group = await repositories.classGroups.findById(scope.classGroupId)
        if (!group || group.schoolId !== schoolId || group.gradeLevelId !== scope.gradeLevelId || group.academicYearId !== academicYearId)
          return false
      }
      return true
    }
    case 'class_group': {
      const group = await repositories.classGroups.findById(scope.classGroupId)
      return Boolean(group && group.schoolId === schoolId && group.academicYearId === academicYearId)
    }
    case 'activity': {
      if (scope.activityId && !sameSchool(await repositories.activities.findById(scope.activityId)))
        return false
      if (!scope.classGroupId)
        return true
      const group = await repositories.classGroups.findById(scope.classGroupId)
      return Boolean(group && group.schoolId === schoolId && group.academicYearId === academicYearId)
    }
  }
}

export async function validateScopeSelections(repositories: SchoolRepositories, schoolId: string, academicYearId: string, scopes: readonly GrantScope[]): Promise<void> {
  const year = await repositories.academicYears.findById(academicYearId)
  if (!year || year.schoolId !== schoolId)
    throw new BusinessRuleViolationError('PERMISSION_SCOPE_YEAR_INVALID', 'Academic year belongs to a different school or does not exist')
  for (const scope of scopes) {
    if (!await scopeSelectionIsValid(repositories, schoolId, academicYearId, scope))
      throw new BusinessRuleViolationError('PERMISSION_SCOPE_TARGET_INVALID', 'Scope target is missing or belongs to another school or academic year')
  }
}

export async function planStaffPermissionGrants(args: StaffGrantPlanInput) {
  const { actor, repositories, staffId } = args
  const staff = await repositories.staffMembers.findById(staffId)
  if (!staff)
    throw new BusinessRuleViolationError('UNKNOWN_STAFF', `Unknown staff: ${staffId}`)
  const filter = { staffId, ...(args.academicYearId ? { academicYearId: args.academicYearId } : {}) }
  const replace = <T extends { id: string }>(rows: T[], proposed?: T, removedId?: string) => [
    ...rows.filter(row => row.id !== proposed?.id && row.id !== removedId),
    ...(proposed ? [proposed] : []),
  ]
  const bindings = replace(await repositories.staffPermissionProfileBindings.list(filter), args.binding, args.removedBindingId)
    .sort((a, b) => a.academicYearId.localeCompare(b.academicYearId) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  const manuals = replace(await repositories.staffManualPermissionAssignments.list(filter), args.manual, args.removedManualId)
  const defaults = replace(await repositories.staffPermissionScopeDefaults.list(filter), args.defaults)
  const defaultByYear = new Map(defaults.map(row => [row.academicYearId, row.scopes]))
  const profiles = new Map((await repositories.staffPermissionProfiles.list({ schoolId: staff.schoolId })).map(row => [row.id, row]))
  if (args.profile)
    profiles.set(args.profile.id, args.profile)
  const desired: StaffPermissionAssignment[] = []
  const bindingWarnings = new Map<string, PermissionResolutionWarning[]>()
  const manualWarnings = new Map<string, PermissionResolutionWarning[]>()
  const report: PermissionResolutionReport = { changes: [], warnings: [] }
  const claimedByYear = new Map<string, Map<Permission, string>>()
  async function resolve(permission: Permission, source: { id: string, academicYearId: string, customScopes: readonly GrantScope[], useDefaultScopes: boolean }, warnings: PermissionResolutionWarning[]) {
    const selections = [...source.customScopes, ...(source.useDefaultScopes ? defaultByYear.get(source.academicYearId) ?? [] : [])]
    const compatible = scopesForPermission(permission, selections)
    const valid: GrantScope[] = []
    for (const scope of compatible) {
      if (await scopeSelectionIsValid(repositories, staff!.schoolId, source.academicYearId, scope))
        valid.push(scope)
      else warnings.push({ permission, reason: 'invalid_scope' })
    }
    if (!valid.length)
      warnings.push({ permission, reason: 'missing_scope' })
    return valid
  }
  for (const binding of bindings) {
    const profile = profiles.get(binding.profileId)
    if (!profile || profile.schoolId !== staff.schoolId)
      throw new BusinessRuleViolationError('UNKNOWN_PERMISSION_PROFILE', `Unknown permission profile: ${binding.profileId}`)
    const claimed = claimedByYear.get(binding.academicYearId) ?? new Map<Permission, string>()
    claimedByYear.set(binding.academicYearId, claimed)
    const warnings: PermissionResolutionWarning[] = []
    bindingWarnings.set(binding.id, warnings)
    for (const permission of profile.permissions) {
      const ownerProfileId = claimed.get(permission)
      if (ownerProfileId) {
        warnings.push({ permission, reason: 'shadowed', ownerProfileId })
        continue
      }
      claimed.set(permission, profile.id)
      const scopes = await resolve(permission, binding, warnings)
      if (scopes.length) {
        desired.push(new StaffPermissionAssignment({
          id: `ppg:${binding.id}:${permission}`,
          staffId,
          schoolId: staff.schoolId,
          academicYearId: binding.academicYearId,
          permission,
          scopes,
          sourceProfileId: profile.id,
          sourceProfileBindingId: binding.id,
        }))
      }
    }
  }
  for (const manual of manuals) {
    const warnings: PermissionResolutionWarning[] = []
    manualWarnings.set(manual.id, warnings)
    const scopes = await resolve(manual.permission, manual, warnings)
    if (scopes.length) {
      desired.push(new StaffPermissionAssignment({
        id: `mpg:${manual.id}`,
        staffId,
        schoolId: staff.schoolId,
        academicYearId: manual.academicYearId,
        permission: manual.permission,
        scopes,
        status: manual.status,
        startsAt: manual.startsAt,
        endsAt: manual.endsAt,
        sourceManualAssignmentId: manual.id,
      }))
    }
  }
  const existing = (await repositories.staffPermissionAssignments.list(filter)).filter(grant => grant.sourceProfileId || grant.sourceManualAssignmentId)
  const existingById = new Map(existing.map(grant => [grant.id, grant]))
  const desiredById = new Map(desired.map(grant => [grant.id, grant]))
  if (actor) {
    const facts = new AccessFacts(actor, repositories)
    for (const grant of desired) await validateGrantTargets(facts, grant)
    const changed = desired.filter((grant) => {
      const before = existingById.get(grant.id)
      return !before || !grantsUnchanged(before, grant)
    })
    await assertGrantDelegation(facts, changed)
  }
  for (const grant of [...desired, ...existing.filter(row => !desiredById.has(row.id))]) {
    const before = existingById.get(grant.id)
    const after = desiredById.get(grant.id)
    if (before && after && grantsUnchanged(before, after)) {
      continue
    }
    if (before && after && before.permission !== after.permission) {
      report.changes.push({ staffId, staffName: `${staff.firstName} ${staff.lastName}`, academicYearId: before.academicYearId, permission: before.permission, change: 'removed', beforeScopes: before.scopes, afterScopes: [] })
      report.changes.push({ staffId, staffName: `${staff.firstName} ${staff.lastName}`, academicYearId: after.academicYearId, permission: after.permission, change: 'added', beforeScopes: [], afterScopes: after.scopes })
      continue
    }
    report.changes.push({ staffId, staffName: `${staff.firstName} ${staff.lastName}`, academicYearId: grant.academicYearId, permission: grant.permission, change: !before ? 'added' : !after ? 'removed' : 'changed', beforeScopes: before?.scopes ?? [], afterScopes: after?.scopes ?? [] })
  }
  for (const source of [...bindings, ...manuals]) {
    const warnings = bindingWarnings.get(source.id) ?? manualWarnings.get(source.id) ?? []
    for (const warning of warnings) report.warnings.push({ ...warning, staffId, staffName: `${staff.firstName} ${staff.lastName}`, academicYearId: source.academicYearId, assignmentId: source.id })
  }
  return { report, desired, existing, bindings, manuals, bindingWarnings, manualWarnings }
}

export async function resolveStaffProfileGrants(args: StaffGrantPlanInput): Promise<PermissionResolutionReport> {
  const { repositories } = args
  const plan = await planStaffPermissionGrants(args)
  const desiredIds = new Set(plan.desired.map(grant => grant.id))
  const existingById = new Map(plan.existing.map(grant => [grant.id, grant]))
  for (const grant of plan.existing) {
    if (!desiredIds.has(grant.id))
      await repositories.staffPermissionAssignments.delete(grant.id)
  }
  const now = new Date()
  for (const grant of plan.desired) {
    const existing = existingById.get(grant.id)
    if (existing && grantsUnchanged(existing, grant))
      continue
    await repositories.staffPermissionAssignments.save(new StaffPermissionAssignment({
      ...grant.data,
      createdAt: existingById.get(grant.id)?.createdAt ?? now,
      updatedAt: now,
    }))
  }
  for (const binding of plan.bindings) {
    const warnings = plan.bindingWarnings.get(binding.id) ?? []
    if (JSON.stringify(binding.warnings) === JSON.stringify(warnings))
      continue
    await repositories.staffPermissionProfileBindings.save(new ProfileBinding({
      ...binding.data,
      warnings,
    }))
  }
  for (const manual of plan.manuals) {
    const warnings = plan.manualWarnings.get(manual.id) ?? []
    if (JSON.stringify(manual.warnings) === JSON.stringify(warnings))
      continue
    await repositories.staffManualPermissionAssignments.save(new ManualAssignment({
      ...manual.data,
      warnings,
    }))
  }
  return plan.report
}
