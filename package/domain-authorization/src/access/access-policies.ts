import { assertGrantDelegation } from './grant-administration';
import { scopesForStaffAssignmentPermission } from './staff-assignment-policy';
import type { BaseRepositoryInterface, CoreEntityKey, CoreEntityMap, Permission, ResourceAccessClause, ResourceAccessScope } from '@edaya/core';
import type { ActorMetadata } from '../model/actor';
import type { AuthorizationRepositories } from '../ports/authorization-repositories';
import { assertCommentOnlyReportCardUpdate, assertDraftReportCardForTeacherComment, collectCommentChanges, Permission as P, resourceAccessScope } from '@edaya/core';
import { ELEVATED_STAFF_PERMISSIONS } from '../permissions/presets';
import { assertHumanOnlyPermission, assertPermissionAssurance } from '../permissions/permission-assurance';
import { AccessFacts, denied } from './facts';
import { familyPolicy, teacherPolicy } from './portal-policies';

export type ActionSelection = Permission | readonly Permission[]
const knownActions = new Set<string>(Object.values(P))

/** Internal identities have explicit capabilities; unknown identities receive none. */
const systemActions: Record<string, readonly Permission[]> = {
  'notification-delivery-webhook': [P.COMMUNICATION_UPDATE, P.COMMUNICATION_CREATE, P.QUERY_COMMUNICATIONS_READ],
  'notify-adapter': [P.COMMUNICATION_CREATE, P.COMMUNICATION_UPDATE, P.QUERY_COMMUNICATIONS_READ],
  'account-invitation-public': [P.ACCESS_CONTROL_READ, P.ACCESS_CONTROL_ASSIGN],
  'cron': [P.COMMUNICATION_CREATE, P.COMMUNICATION_SEND, P.QUERY_COMMUNICATIONS_READ, P.ATTENDANCE_READ, P.QUERY_ATTENDANCE_READ, P.QUERY_TIMETABLE_READ, P.PAYMENT_READ],
  'school-bootstrap': [P.PLATFORM_REGISTER_SCHOOL, P.SCHOOL_STRUCTURE_CONFIGURE, P.SCHOOL_LIFECYCLE_MANAGE, P.ACCESS_CONTROL_ASSIGN, P.STAFF_CREATE, P.QUERY_WORKSPACE_READ],
}

export class AccessPolicies {
  constructor(readonly actor: ActorMetadata, readonly repositories: AuthorizationRepositories) {}

  async scope(actions: ActionSelection, resource: CoreEntityKey, intent: 'read' | 'write' = 'read'): Promise<ResourceAccessScope> {
    const requested = typeof actions === 'string' ? [actions] : actions
    if (!requested.length || requested.some(action => !knownActions.has(action))) return denied('Unknown or empty action')
    const facts = new AccessFacts(this.actor, this.repositories)
    await facts.validateActor()
    const clauses: ResourceAccessClause[] = []
    for (const action of new Set(requested)) clauses.push(...await this.actionScope(facts, action, resource, intent))
    return resourceAccessScope(this.actor.schoolId, resource, clauses)
  }

  private async actionScope(facts: AccessFacts, action: Permission, resource: CoreEntityKey, intent: 'read' | 'write'): Promise<ResourceAccessClause[]> {
    const actor = this.actor
    if (actor.kind === 'system') return systemActions[actor.systemId]?.includes(action) ? [{ target: { kind: 'school' } }] : []
    if (actor.kind === 'teacher') return teacherPolicy(facts, action, resource, intent)
    if (actor.kind === 'guardian' || actor.kind === 'student') return familyPolicy(facts, action, resource, intent)
    const owner = await facts.owner()
    assertHumanOnlyPermission(actor.accountKind, action, owner)
    assertPermissionAssurance(actor.assuranceLevel, action, actor.accountKind, owner)
    if (owner && ELEVATED_STAFF_PERMISSIONS.includes(action)) return [{ target: { kind: 'school' } }]
    return (await facts.staffGrants(action)).flatMap(grant => grant.scopes.map(target => ({
      target, academicYearId: grant.academicYearId,
      ...(resource === 'studentNotes' ? { noteVisibility: 'staff' as const,
        ...(intent === 'write' ? { authorStaffId: actor.staffMemberId } : {}),
      } : {}),
    })))
  }

  /** Only genuinely school-wide operations may omit resource targets. */
  async assertSchool(action: ActionSelection): Promise<void> {
    const scope = await this.scope(action, 'schools', 'write')
    if (!scope.clauses.some(clause => clause.target.kind === 'school')) denied()
  }

  async assertResources<K extends CoreEntityKey>(actions: ActionSelection, resource: K, ids: readonly string[], intent: 'read' | 'write' = 'write'): Promise<void> {
    const expected = [...new Set(ids)]
    if (!expected.length) return denied('Resource assertions require a target')
    const scope = await this.scope(actions, resource, intent)
    const rows = await this.repositories[resource].forAccess(scope).findByIds(expected)
    if (rows.length !== expected.length) denied()
  }

  async assertSave<K extends CoreEntityKey>(actions: ActionSelection, resource: K, entity: CoreEntityMap[K], existing?: CoreEntityMap[K]): Promise<ResourceAccessScope> {
    const scope = await this.scope(actions, resource, 'write')
    if (resource === 'assessmentResults') {
      for (const result of [existing, entity]) {
        if (result) await this.grades.assertInput(result as CoreEntityMap['assessmentResults'])
      }
    }
    if (resource === 'schools' && existing) {
      const before = existing as CoreEntityMap['schools']
      const after = entity as CoreEntityMap['schools']
      if (before.ownerSubjectId !== after.ownerSubjectId
        && (this.actor.kind !== 'staff' || this.actor.accountKind !== 'human' || this.actor.subjectId !== before.ownerSubjectId)) denied('Only the current human owner can transfer ownership')
    }
    if (resource === 'staffMembers') {
      const before = existing as CoreEntityMap['staffMembers'] | undefined
      const after = entity as CoreEntityMap['staffMembers']
      if (after.accountKind === 'service' || before?.accountKind === 'service') denied('Service accounts must be managed through service-account commands')
      if (before && before.subjectId !== after.subjectId) denied('Staff identity links must be managed through invitation commands')
    }
    if (resource === 'studentNotes' && !existing) {
      if (this.actor.kind !== 'staff' || (entity as CoreEntityMap['studentNotes']).authorStaffId !== this.actor.staffMemberId) denied('A note must identify its current staff author')
    }
    if (resource === 'staffPermissionAssignments' || resource === 'staffAssignments') {
      const facts = new AccessFacts(this.actor, this.repositories)
      if (resource === 'staffPermissionAssignments') {
        const assignment = entity as CoreEntityMap['staffPermissionAssignments']
        await facts.one('staffMembers', assignment.staffId)
        await assertGrantDelegation(facts, [assignment])
      }
      else {
        const assignment = entity as CoreEntityMap['staffAssignments']
        const target = await facts.assignmentTarget(assignment)
        await assertGrantDelegation(facts, assignment.permissions.map(permission => ({
          permission, scopes: scopesForStaffAssignmentPermission(permission, target), academicYearId: assignment.academicYearId,
        })))
      }
    }
    const repo = this.repositories[resource].forAccess(scope) as unknown as BaseRepositoryInterface<CoreEntityMap[K]>
    if (existing) await repo.assertAccess(existing)
    await repo.assertAccess(entity)
    if (this.actor.kind === 'teacher' && resource === 'results') {
      if (!existing) denied('Teachers may update report comments only')
      await this.assertTeacherComments(entity as CoreEntityMap['results'], existing as CoreEntityMap['results'])
    }
    return scope
  }

  private async assertTeacherComments(after: CoreEntityMap['results'], before: CoreEntityMap['results']): Promise<void> {
    const facts = new AccessFacts(this.actor, this.repositories)
    const teaching = await facts.teaching()
    assertDraftReportCardForTeacherComment(before)
    assertCommentOnlyReportCardUpdate(before, after)
    for (const change of collectCommentChanges(before, after)) {
      if (change.kind === 'subject') {
        if (!teaching.subjects.some(subject => subject.classSubjectId === change.classSubjectId
          && subject.classGroupId === after.classGroupId)) denied()
      }
      else if (!teaching.homerooms.includes(after.classGroupId)) denied()
    }
  }

  readonly grades = {
    readScope: () => this.scope(P.GRADE_READ, 'assessmentResults'),
    assertInput: async (target: { assessmentId: string, studentId: string }) => {
      await this.assertResources(P.GRADE_INPUT, 'assessments', [target.assessmentId])
      await this.assertResources(P.GRADE_INPUT, 'students', [target.studentId])
    },
  }
}

export function createAccessPolicies(args: { actor: ActorMetadata, repositories: AuthorizationRepositories }): AccessPolicies {
  return new AccessPolicies(args.actor, args.repositories)
}
