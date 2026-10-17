import type { GrantScope, Permission, UserScopeSelection } from '@edaya/core'
import type { AccessFacts } from './facts'
import { permissionScopeSelectionsSchema, validatePermissionScopes } from '@edaya/core'
import { AuthorizationError } from '../model/errors'
import { validateScopeSelectionTargets } from './grant-administration'

async function label(facts: AccessFacts, scope: GrantScope): Promise<string> {
  switch (scope.kind) {
    case 'school': return 'School'
    case 'all': return `All ${scope.grain.replaceAll('_', ' ')} resources`
    case 'student': {
      const student = await facts.one('students', scope.studentId)
      return `${student.firstName} ${student.lastName}`
    }
    case 'class_group': return (await facts.one('classGroups', scope.classGroupId)).name
    case 'class_subject': {
      const group = await facts.one('classGroups', scope.classGroupId)
      const subject = scope.classSubjectId ? await facts.one('classSubjects', scope.classSubjectId) : undefined
      return `${group.name} / ${subject ? (await facts.one('subjects', subject.subjectId)).name : 'All subjects'}`
    }
    case 'grade_level': return (await facts.one('gradeLevels', scope.gradeLevelId)).name
    case 'grade_level_subject': {
      const grade = await facts.one('gradeLevels', scope.gradeLevelId)
      const subject = scope.gradeLevelSubjectId ? await facts.one('gradeLevelSubjects', scope.gradeLevelSubjectId) : undefined
      return `${grade.name} / ${subject ? (await facts.one('subjects', subject.subjectId)).name : 'All subjects'}`
    }
    case 'activity': {
      const activity = scope.activityId ? (await facts.one('activities', scope.activityId)).name : 'All activities'
      return scope.classGroupId ? `${(await facts.one('classGroups', scope.classGroupId)).name} / ${activity}` : activity
    }
  }
}

/** Deleted, foreign and mismatched references share one non-disclosing display state. */
export async function renderGrantScopes(facts: AccessFacts, input: { permission: Permission, scopes: readonly GrantScope[], academicYearId: string }) {
  validatePermissionScopes(input.permission, input.scopes)
  return renderScopes(facts, input)
}

/** Defaults contain resource selections only, including dormant selections. */
export async function renderScopeSelections(facts: AccessFacts, input: { scopes: readonly UserScopeSelection[], academicYearId: string }) {
  return renderScopes(facts, { ...input, scopes: permissionScopeSelectionsSchema.parse(input.scopes) })
}

async function renderScopes<T extends GrantScope>(facts: AccessFacts, input: { scopes: readonly T[], academicYearId: string }) {
  await facts.one('academicYears', input.academicYearId)
  return Promise.all(input.scopes.map(async (scope) => {
    try {
      await validateScopeSelectionTargets(facts, { ...input, scopes: [scope] })
      return { scope, label: await label(facts, scope), missing: false }
    }
    catch (error) {
      if (!(error instanceof AuthorizationError))
        throw error
      return { scope, label: 'Unavailable resource', missing: true }
    }
  }))
}
