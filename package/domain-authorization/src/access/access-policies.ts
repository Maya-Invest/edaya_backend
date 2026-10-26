import type { Attachment, BaseRepositoryInterface, CoreEntityKey, CoreEntityMap, DashboardScopes, Permission, ResourceAccessClause, ResourceAccessScope } from '@edaya/core'
import type { SchoolScopedActorMetadata } from '../model/actor'
import type { AuthorizationRepositories } from '../ports/authorization-repositories'
import type { DelegatedGrant } from './grant-administration'
import { assertCommentOnlyReportCardUpdate, assertDraftReportCardForTeacherComment, BusinessRuleViolationError, collectCommentChanges, Permission as P, resourceAccessScope } from '@edaya/core'
import { AuthorizationError } from '../model/errors'
import { assertHumanOnlyPermission, assertPermissionAssurance } from '../permissions/permission-assurance'
import { s2sMayExercise } from '../s2s/access-class'
import { assertActivityPlacements } from './activity-placements'
import { CommunicationsAccessPolicy, DELIVERY_WRITER_SYSTEM_IDS } from './communications-policies'
import { ConversationAccessPolicy } from './conversation-policies'
import { assertCurriculumPlacements } from './curriculum-placements'
import { DisciplineAccessPolicy } from './discipline-policies'
import { DocumentAccessPolicy } from './document-policies'
import { EntityAccessPolicy } from './entity-policies'
import { AccessFacts, denied } from './facts'
import { FamilyFeedbackAccessPolicy } from './family-feedback-policies'
import { FinanceAccessPolicy } from './finance-policies'
import { assertAssignmentDelegation, assertGrantDelegation } from './grant-administration'
import { incidentChanges } from './incident-changes'
import { LogbookAccessPolicy } from './logbook-policies'
import { MarksReviewAccessPolicy } from './marks-review-policies'
import { NotificationDeliveryAccessPolicy } from './notification-delivery-policies'
import { SCHOOL_OWNER_ACTIONS } from './owner-authority'
import { familyPolicy, teacherPolicy } from './portal-policies'
import { ReportCardAccessPolicy } from './report-card-policies'
import { TeacherCorrectionsAccessPolicy } from './teacher-corrections-policies'

export type MutationOperation = 'create' | 'update' | 'delete' | 'command'
export type ActionSelection = Permission | readonly Permission[]
const knownActions = new Set<string>(Object.values(P))

/** Internal identities have explicit capabilities; unknown identities receive none. */
const systemActions: Record<string, readonly Permission[]> = {
  'notification-delivery-webhook': [P.COMMUNICATION_DRAFT_MANAGE, P.PERSONAL_COMMUNICATIONS_READ],
  'notify-adapter': [P.COMMUNICATION_DRAFT_MANAGE, P.PERSONAL_COMMUNICATIONS_READ],
  'account-invitation-public': [P.ACCESS_CONTROL_READ, P.ACCESS_CONTROL_MANAGE],
  'invitation-dispatch': [P.ACCESS_CONTROL_READ],
  'preparePrivateFileCleanup': [P.ATTACHMENT_CONFIGURE],
  'private-file-cleanup': [P.ATTACHMENT_CONFIGURE],
  'processDueNotifications': [P.ASSESSMENT_READ, P.TIMETABLE_READ, P.ACTIVITY_READ],
  'reconcilePendingDeliveries': [P.PERSONAL_COMMUNICATIONS_READ, P.COMMUNICATION_DRAFT_MANAGE],
  'expireAccountInvitations': [P.ACCESS_CONTROL_READ, P.ACCESS_CONTROL_MANAGE],
  'document-render': [P.REPORT_CARD_EXPORT, P.ATTACHMENT_CONFIGURE, P.ATTACHMENT_READ, P.DOCUMENT_VOID, P.REPORT_CARD_PUBLISH, P.CLASS_LOGBOOK_READ, P.PAYMENT_READ, P.FINANCIAL_REPORT_READ, P.ENROLLMENT_READ, P.STUDENT_READ, P.TIMETABLE_READ, P.ATTENDANCE_READ, P.DISCIPLINE_READ, P.CLASS_READ, P.REPORT_CARD_READ],
  'advanceFamilyFeedbackCampaigns': [P.FAMILY_FEEDBACK_CAMPAIGN_READ, P.FAMILY_FEEDBACK_CAMPAIGN_MANAGE],
  'fixture-seed': [...SCHOOL_OWNER_ACTIONS, P.PLATFORM_REGISTER_SCHOOL],
  'school-bootstrap': [P.PLATFORM_REGISTER_SCHOOL, P.SCHOOL_CONFIGURE, P.SCHOOL_LIFECYCLE_MANAGE, P.ACCESS_CONTROL_MANAGE, P.STAFF_MANAGE, P.WORKSPACE_ACCESS],
}

export const OVERVIEW_RESOURCES = ['students', 'guardians', 'staffMembers', 'teachers', 'studentCharges', 'results', 'incidents', 'attendance', 'assessments', 'assessmentResults', 'enrollments', 'calendarEvents', 'classGroups', 'payments', 'studentDisciplinaryActions', 'activities', 'academicPeriods'] as const
export type OverviewRepositories = Pick<AuthorizationRepositories, typeof OVERVIEW_RESOURCES[number]>

export class AccessPolicies {
  private readonly preflightResources = new Map<string, Promise<void>>()
  constructor(readonly actor: SchoolScopedActorMetadata, readonly repositories: AuthorizationRepositories, private readonly operationFacts?: AccessFacts) {}

  /** A fresh authorization snapshot for one transaction's preflight phase; never retain across writes. */
  forOperation(): AccessPolicies {
    return new AccessPolicies(this.actor, this.repositories, new AccessFacts(this.actor, this.repositories))
  }

  private facts(): AccessFacts {
    return this.operationFacts ?? new AccessFacts(this.actor, this.repositories)
  }

  entity<K extends CoreEntityKey>(resource: K): EntityAccessPolicy<K> {
    return new EntityAccessPolicy(this, resource)
  }

  async scope(actions: ActionSelection, resource: CoreEntityKey, intent: 'read' | 'write' = 'read', operation?: MutationOperation): Promise<ResourceAccessScope> {
    const requested = typeof actions === 'string' ? [actions] : actions
    if (!requested.length || requested.some(action => !knownActions.has(action)))
      return denied('Unknown or empty action')
    const facts = this.facts()
    await facts.validateActor()
    const clauses: ResourceAccessClause[] = []
    for (const action of new Set(requested)) {
      try {
        clauses.push(...await this.actionScope(facts, action, resource, intent, operation))
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
    }
    if (!clauses.length)
      return denied('No authority for this action and resource')
    return resourceAccessScope(this.actor.schoolId, resource, intent === 'read' && resource === 'calendarEvents'
      ? clauses.map(clause => ({ ...clause, calendarAncestors: true }))
      : clauses)
  }

  private async actionScope(facts: AccessFacts, action: Permission, resource: CoreEntityKey, intent: 'read' | 'write', operation?: MutationOperation): Promise<ResourceAccessClause[]> {
    const actor = this.actor
    if (actor.kind === 'system') {
      if (actor.systemId === 'auto-billing')
        return action === P.PAYMENT_RECORD && intent === 'write' && operation === 'create' && ['studentServiceEnrollments', 'studentCharges'].includes(resource) ? [{ target: { kind: 'school' } }] : []
      if (action === P.COMMUNICATION_DRAFT_MANAGE && ['notification-delivery-webhook', 'notify-adapter', 'reconcilePendingDeliveries'].includes(actor.systemId)
        && (resource !== 'messageDeliveries' || (intent === 'write' && (!operation || operation === 'delete')))) {
        return []
      }
      if (actor.systemId === 'reconcilePendingDeliveries' && intent === 'write' && operation === 'create')
        return []
      return systemActions[actor.systemId]?.includes(action) ? [{ target: { kind: 'school' } }] : []
    }
    if (actor.kind === 's2s') {
      const client = await this.repositories.s2sClients.findById(actor.actorId)
      return client?.isActive(facts.now) && client.schoolId === actor.schoolId && s2sMayExercise(client.accessClass, action)
        ? [{ target: { kind: 'school' } }]
        : []
    }
    if (actor.kind === 'teacher')
      return teacherPolicy(facts, action, resource, intent, operation)
    if (actor.kind === 'guardian' || actor.kind === 'student')
      return familyPolicy(facts, action, resource, intent, operation)
    const owner = await facts.owner()
    assertHumanOnlyPermission(actor.accountKind, action, owner)
    assertPermissionAssurance(actor.assuranceLevel, action, actor.accountKind, owner)
    if (owner && SCHOOL_OWNER_ACTIONS.includes(action))
      return [{ target: { kind: 'school' } }]
    if (actor.accountKind === 'human' && intent === 'read' && action === P.WORKSPACE_ACCESS && resource === 'staffAssignments')
      return [{ target: { kind: 'records', ids: (await facts.list('staffAssignments', { staffId: actor.staffMemberId })).map(assignment => assignment.id) } }]
    // Selected staff profile is the caller record, not a directory grant.
    if (actor.accountKind === 'human' && action === P.WORKSPACE_ACCESS && intent === 'read' && ['schools', 'academicYears', 'academicPeriods', 'periodDefinitions'].includes(resource))
      return [{ target: { kind: 'school' } }]
    const ownStaffProfile: ResourceAccessClause[] = intent === 'read'
      && action === P.STAFF_READ
      && resource === 'staffMembers'
      ? [{ target: { kind: 'records', ids: [actor.staffMemberId] } }]
      : []
    const ownCommunications: ResourceAccessClause[] = action === P.PERSONAL_COMMUNICATIONS_READ && actor.accountKind === 'human'
      ? resource === 'messageDeliveries'
        ? [{ target: { kind: 'recipient', actorKind: actor.kind, actorId: actor.actorId, subjectId: actor.subjectId } }]
        : resource === 'staffMembers'
          ? [{ target: { kind: 'records', ids: [actor.actorId] } }]
          : resource === 'announcements' || resource === 'announcementTargets' ? [{ target: { kind: 'audience', actorKind: actor.kind, actorId: actor.actorId, classGroupIds: [] } }] : []
      : []
    return [...ownStaffProfile, ...ownCommunications, ...(await facts.staffGrants(action)).flatMap(grant => grant.scopes.map(target => ({
      target,
      academicYearId: grant.academicYearId,
      ...(resource === 'studentNotes'
        ? { noteVisibility: 'staff' as const, ...(intent === 'write' ? { authorStaffId: actor.staffMemberId } : {}) }
        : {}),
    })))]
  }

  /** Only genuinely school-wide operations may omit resource targets. */
  async assertSchool(action: ActionSelection): Promise<void> {
    const scope = await this.scope(action, 'schools', action === P.WORKSPACE_ACCESS ? 'read' : 'write', 'command')
    if (!scope.clauses.some(clause => clause.target.kind === 'school'))
      denied()
  }

  async assertResources<K extends CoreEntityKey>(actions: ActionSelection, resource: K, ids: readonly string[], intent: 'read' | 'write' = 'write', operation: MutationOperation = 'command'): Promise<ResourceAccessScope> {
    const expected = [...new Set(ids)]
    if (!expected.length)
      return denied('Resource assertions require a target')
    return this.completeAction(actions, async (action) => {
      const scope = await this.scope(action, resource, intent, operation)
      const key = JSON.stringify([scope, [...expected].sort()])
      const verify = async () => {
        const rows = await this.repositories[resource].forAccess(scope).findByIds(expected)
        if (rows.length !== expected.length)
          denied()
      }
      // Only forOperation snapshots may reuse checks; they end before persistence.
      if (this.operationFacts) {
        let pending = this.preflightResources.get(key)
        if (!pending) {
          pending = verify()
          this.preflightResources.set(key, pending)
        }
        await pending
      }
      else {
        await verify()
      }
      return scope
    })
  }

  async assertSave<K extends CoreEntityKey>(actions: ActionSelection, resource: K, entity: CoreEntityMap[K], existing?: CoreEntityMap[K]): Promise<ResourceAccessScope> {
    return this.completeAction(actions, action => this.assertSaveForAction(action, resource, entity, existing))
  }

  /** Alternatives must each authorize the complete mutation, including its previous placement. */
  private async completeAction<T>(actions: ActionSelection, evaluate: (action: Permission) => Promise<T>): Promise<T> {
    let rejection: AuthorizationError | undefined
    for (const action of new Set(typeof actions === 'string' ? [actions] : actions)) {
      try {
        return await evaluate(action)
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
        rejection = error
      }
    }
    if (rejection)
      throw rejection
    return denied('Unknown or empty action')
  }

  private async assertSaveForAction<K extends CoreEntityKey>(action: Permission, resource: K, entity: CoreEntityMap[K], existing?: CoreEntityMap[K]): Promise<ResourceAccessScope> {
    if (resource === 'announcements' && action === P.COMMUNICATION_SEND)
      return this.communications.assertPublish(entity as CoreEntityMap['announcements'], existing as CoreEntityMap['announcements'] | undefined)
    const scope = await this.scope(action, resource, 'write', existing ? 'update' : 'create')
    await assertCurriculumPlacements(this, action, resource, existing ? [existing, entity] : [entity])
    if (resource === 'activities' && existing)
      await assertActivityPlacements(this, scope, [existing.id])
    if (resource === 'announcements' && !existing && (entity as CoreEntityMap['announcements']).isPublished)
      await this.communications.assertPublish(entity as CoreEntityMap['announcements'])
    if (resource === 'accountInvitations') {
      const facts = this.facts()
      for (const value of [existing, entity]) {
        if (!value)
          continue
        const invitation = value as CoreEntityMap['accountInvitations']
        const target = { staff: 'staffMembers', teacher: 'teachers', guardian: 'guardians', student: 'students' } as const
        await facts.one(target[invitation.kind], invitation.targetId)
        await facts.one('staffMembers', invitation.createdByStaffId)
      }
    }
    if (resource === 'messageDeliveries') {
      await this.assertIntegrationCaller(DELIVERY_WRITER_SYSTEM_IDS)
      const before = existing as CoreEntityMap['messageDeliveries'] | undefined
      const after = entity as CoreEntityMap['messageDeliveries']
      if (before && (before.subjectId !== after.subjectId || before.recipientKind !== after.recipientKind || before.recipientId !== after.recipientId || before.sourceKey !== after.sourceKey || before.announcementId !== after.announcementId || before.eventKey !== after.eventKey))
        denied('A delivery cannot be reassigned to another recipient or source')
      if (!before && after.recipientKind && after.recipientId) {
        const resources = { staff: 'staffMembers', teacher: 'teachers', guardian: 'guardians', student: 'students' } as const
        const profile = await this.facts().one(resources[after.recipientKind], after.recipientId)
        if (profile.subjectId !== after.subjectId || ('isActive' in profile && !profile.isActive) || ('hasAccess' in profile && !profile.hasAccess) || ('status' in profile && profile.status !== 'active'))
          denied('Delivery recipient must identify an active linked profile')
      }
    }
    if (resource === 'assessmentResults') {
      for (const result of [existing, entity]) {
        if (result)
          await this.assertGradeTargets(action, result as CoreEntityMap['assessmentResults'])
      }
    }
    if (resource === 'incidents') {
      const after = entity as CoreEntityMap['incidents']
      const before = existing as CoreEntityMap['incidents'] | undefined
      const changes = incidentChanges(after, before)
      const required = [
        ...(changes.resolution ? [P.DISCIPLINE_VALIDATE] : []),
        ...(changes.cancellation ? [P.DISCIPLINE_MANAGE] : []),
      ]
      for (const permission of required) {
        if (permission === action)
          continue
        const repository = this.repositories.incidents.forAccess(await this.scope(permission, 'incidents', 'write'))
        if (before)
          await repository.assertAccess(before)
        await repository.assertAccess(after)
      }
    }
    if (resource === 'attendance') {
      const after = entity as CoreEntityMap['attendance']
      const before = existing as CoreEntityMap['attendance'] | undefined
      if ((after.justificationStatus === 'excused' || after.justificationStatus === 'rejected')
        && (before?.justificationStatus !== after.justificationStatus || before?.reason !== after.reason
          || before?.justifiedAt?.getTime() !== after.justifiedAt?.getTime() || before?.justifiedByStaffId !== after.justifiedByStaffId)) {
        const review = this.repositories.attendance.forAccess(await this.scope(P.ATTENDANCE_VALIDATE, 'attendance', 'write'))
        if (before)
          await review.assertAccess(before)
        await review.assertAccess(after)
      }
    }
    const lifecycleChange = resource === 'academicYears'
      ? (entity as CoreEntityMap['academicYears']).status !== ((existing as CoreEntityMap['academicYears'] | undefined)?.status ?? 'draft')
      : resource === 'academicPeriods' && (entity as CoreEntityMap['academicPeriods']).isPublished !== ((existing as CoreEntityMap['academicPeriods'] | undefined)?.isPublished ?? false)
    if (lifecycleChange && action !== P.SCHOOL_LIFECYCLE_MANAGE) {
      const lifecycle = (this.repositories[resource] as unknown as BaseRepositoryInterface<CoreEntityMap[K]>).forAccess(await this.scope(P.SCHOOL_LIFECYCLE_MANAGE, resource, 'write'))
      if (existing)
        await lifecycle.assertAccess(existing)
      await lifecycle.assertAccess(entity)
    }
    if (resource === 'schools' && existing) {
      const before = existing as CoreEntityMap['schools']
      const after = entity as CoreEntityMap['schools']
      if (before.ownerSubjectId !== after.ownerSubjectId
        && (this.actor.kind !== 'staff' || this.actor.accountKind !== 'human' || this.actor.subjectId !== before.ownerSubjectId)) {
        denied('Only the current human owner can transfer ownership')
      }
    }
    if (['staffMembers', 'teachers', 'guardians', 'students'].includes(resource)) {
      const before = existing as CoreEntityMap['staffMembers'] | undefined
      const after = entity as CoreEntityMap['staffMembers']
      if (before?.subjectId !== after.subjectId)
        denied('Identity links must be managed through access-control commands')
    }
    if (this.actor.kind === 'guardian' && (resource === 'guardians' || resource === 'guardianLinks')) {
      if (!existing)
        denied('Guardians may update existing preferences only')
      const editable = new Set(resource === 'guardians'
        ? ['photoUrl', 'phone', 'alternativePhone', 'email', 'emailNotificationsEnabled', 'smsNotificationsEnabled', 'pushNotificationsEnabled']
        : ['receivesAcademicReports', 'receivesAttendanceAlerts'])
      const before = existing.data as unknown as Record<string, unknown>
      const after = entity.data as unknown as Record<string, unknown>
      for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (!editable.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
          denied('Guardians may change their own contact and notification preferences only')
      }
    }
    if (resource === 'staffMembers') {
      const before = existing as CoreEntityMap['staffMembers'] | undefined
      const after = entity as CoreEntityMap['staffMembers']
      if (before?.isActive && !after.isActive && this.actor.kind === 'staff' && this.actor.staffMemberId === after.id)
        denied('Staff members cannot deactivate their own account')
      if (after.accountKind === 'service' || before?.accountKind === 'service')
        denied('Service accounts must be managed through service-account commands')
    }
    if (resource === 'studentNotes' && !existing) {
      const authorStaffId = (entity as CoreEntityMap['studentNotes']).authorStaffId
      if (this.actor.kind === 'system' && this.actor.systemId === 'fixture-seed')
        await this.facts().one('staffMembers', authorStaffId)
      else if (this.actor.kind !== 'staff' || authorStaffId !== this.actor.staffMemberId)
        denied('A note must identify its current staff author')
    }
    if (resource === 'staffPermissionAssignments' || resource === 'staffAssignments') {
      const facts = this.facts()
      for (const value of [existing, entity]) {
        if (value)
          await this.assertStaffAdministrationTarget((value as CoreEntityMap['staffPermissionAssignments'] | CoreEntityMap['staffAssignments']).staffId)
      }
      if (resource === 'staffPermissionAssignments') {
        const assignment = entity as CoreEntityMap['staffPermissionAssignments']
        await facts.one('staffMembers', assignment.staffId)
        await assertGrantDelegation(facts, [assignment])
      }
      else {
        await assertAssignmentDelegation(facts, entity as CoreEntityMap['staffAssignments'])
      }
    }
    const repo = this.repositories[resource].forAccess(scope) as unknown as BaseRepositoryInterface<CoreEntityMap[K]>
    if (existing)
      await repo.assertAccess(existing)
    await repo.assertAccess(entity)
    if (resource === 'results' && action === P.REPORT_CARD_COMMENT) {
      if (!existing)
        denied('Comments require an existing report')
      await this.assertReportCommentProposal(entity as CoreEntityMap['results'], existing as CoreEntityMap['results'])
    }
    if (this.actor.kind === 'teacher' && resource === 'results') {
      if (!existing)
        denied('Teachers may update report comments only')
      await this.assertTeacherComments(entity as CoreEntityMap['results'], existing as CoreEntityMap['results'])
    }
    return scope
  }

  /** Human staff administration cannot bypass service-account lifecycle and delegation policies. */
  async assertStaffAdministrationTarget(staffId: string): Promise<void> {
    const target = await this.facts().one('staffMembers', staffId)
    if (target.accountKind === 'service')
      denied('Service account grants must be managed through service-account commands')
  }

  assertTeacherSelfProfile(after: CoreEntityMap['teachers'], before: CoreEntityMap['teachers'] | undefined): ResourceAccessScope {
    const actor = this.actor
    if (actor.kind !== 'teacher' || !before)
      denied('Teachers may update only their own profile')
    if (after.id !== before.id || after.id !== actor.teacherId || after.schoolId !== actor.schoolId || before.schoolId !== actor.schoolId)
      denied('Teachers may update only their own profile')
    if (after.code !== before.code
      || after.photoUrl !== before.photoUrl
      || after.signatureAttachmentId !== before.signatureAttachmentId
      || after.notificationEmail !== before.notificationEmail
      || after.notificationPhone !== before.notificationPhone
      || after.subjectId !== before.subjectId
      || after.isActive !== before.isActive
      || after.createdAt.getTime() !== before.createdAt.getTime()) {
      denied('Teachers cannot change administrative profile fields')
    }
    return resourceAccessScope(actor.schoolId, 'teachers', [{ target: { kind: 'records', ids: [actor.teacherId] } }])
  }

  private async assertTeacherComments(after: CoreEntityMap['results'], before: CoreEntityMap['results']): Promise<void> {
    assertDraftReportCardForTeacherComment(before)
    await this.assertReportCommentProposal(after, before)
  }

  async assertReportCommentProposal(after: CoreEntityMap['results'], before: CoreEntityMap['results']): Promise<void> {
    await this.assertResources(P.REPORT_CARD_COMMENT, 'results', [before.id])
    assertCommentOnlyReportCardUpdate(before, after)
    if (this.actor.kind !== 'teacher') {
      for (const change of collectCommentChanges(before, after)) {
        if (change.kind === 'subject') {
          await this.assertResources(P.REPORT_CARD_COMMENT, 'classSubjects', [change.classSubjectId])
        }
        else {
          const scope = await this.scope(P.REPORT_CARD_COMMENT, 'classGroups', 'write', 'command')
          const broad = scope.clauses.filter(clause => ['school', 'grade_level', 'class_group'].includes(clause.target.kind) || (clause.target.kind === 'all' && ['grade_level', 'class_group'].includes(clause.target.grain)))
          if (!broad.length || !await this.repositories.classGroups.forAccess(resourceAccessScope(this.actor.schoolId, 'classGroups', broad)).findById(after.classGroupId))
            denied()
        }
      }
      return
    }
    const teaching = await this.facts().teaching()
    for (const change of collectCommentChanges(before, after)) {
      if (change.kind === 'subject') {
        if (!teaching.subjects.some(subject => subject.classSubjectId === change.classSubjectId
          && subject.classGroupId === after.classGroupId)) {
          denied()
        }
      }
      else if (!teaching.homerooms.includes(after.classGroupId)) {
        denied()
      }
    }
  }

  /** Bounded equivalent of grade-save policy, retaining both old and proposed targets. */
  async assertMarkBatch(action: Permission.GRADE_MANAGE, proposed: CoreEntityMap['assessmentResults'][], existing: CoreEntityMap['assessmentResults'][]): Promise<ResourceAccessScope> {
    const scope = await this.scope(action, 'assessmentResults', 'write')
    const records = [...existing, ...proposed]
    for (const [resource, ids] of [
      ['assessments', [...new Set(records.map(row => row.assessmentId))]],
      ['students', [...new Set(records.map(row => row.studentId))]],
    ] as const) {
      for (let offset = 0; offset < ids.length; offset += 500) await this.assertResources(action, resource, ids.slice(offset, offset + 500))
    }
    const repository = this.repositories.assessmentResults.forAccess(scope)
    if (repository.assertAccessBatch) {
      await repository.assertAccessBatch(records)
    }
    else {
      for (const record of records) await repository.assertAccess(record)
    }
    return scope
  }

  private async assertGradeTargets(action: Permission, target: { assessmentId: string, studentId: string }): Promise<void> {
    await this.assertResources(action, 'assessments', [target.assessmentId])
    await this.assertResources(action, 'students', [target.studentId])
  }

  private async serviceAccount(action: Permission, id: string, allowInactive = false) {
    await this.assertSchool(action)
    const existing = await this.repositories.staffMembers.forSchool!(this.actor.schoolId).findById(id)
    if (!existing || existing.accountKind !== 'service' || (!allowInactive && !existing.isActive))
      throw new BusinessRuleViolationError('SERVICE_ACCOUNT_NOT_FOUND', 'Service account not found for this school')
    if (existing.serviceElevated && !await this.facts().owner())
      denied('Only the school owner can manage an owner service account')
    return existing
  }

  readonly serviceAccounts = {
    assertCreate: async (input: { elevated?: boolean, permissionAssignments?: readonly DelegatedGrant[] }) => {
      await this.assertSchool(P.SERVICE_ACCOUNT_MANAGE)
      const facts = this.facts()
      if (input.elevated && !await facts.owner())
        denied('Only a school owner can create an owner service account')
      await assertGrantDelegation(facts, input.permissionAssignments ?? [])
    },
    assertUpdate: async (id: string, grants?: readonly DelegatedGrant[]) => {
      const existing = await this.serviceAccount(P.SERVICE_ACCOUNT_MANAGE, id)
      if (grants)
        await assertGrantDelegation(this.facts(), grants)
      return existing
    },
    assertRevoke: (id: string) => this.serviceAccount(P.SERVICE_ACCOUNT_MANAGE, id, true),
    assertRotateKey: async (id: string) => {
      const existing = await this.serviceAccount(P.SERVICE_ACCOUNT_MANAGE, id)
      const facts = this.facts()
      const grants = await facts.list('staffPermissionAssignments', { staffId: id, status: 'active' })
      // A new key transfers all still-usable authority, including later academic years.
      await assertGrantDelegation(facts, grants.filter(grant => !grant.endsAt || facts.now < grant.endsAt))
      return existing
    },
  }

  readonly conversations = new ConversationAccessPolicy(this)
  readonly teacherCorrections = new TeacherCorrectionsAccessPolicy(this)
  readonly discipline = new DisciplineAccessPolicy(this)

  async assertIntegrationCaller(systemIds: readonly string[]): Promise<void> {
    const actor = this.actor
    await new AccessFacts(actor, this.repositories).validateActor()
    if (actor.kind === 'staff' && actor.accountKind === 'service')
      return
    if (actor.kind === 'system' && systemIds.includes(actor.systemId))
      return
    denied('This business operation requires an admitted machine caller')
  }

  readonly notifications = new NotificationDeliveryAccessPolicy(this)
  readonly communications = new CommunicationsAccessPolicy(this)

  readonly marksReview = new MarksReviewAccessPolicy(this)

  readonly activityRoster = {
    context: async (activityId: string) => {
      await this.assertResources(P.ACTIVITY_READ, 'activities', [activityId], 'read')
      const participantScope = await this.scope(P.ACTIVITY_READ, 'activityEnrollments')
      let candidateScope: ResourceAccessScope | undefined
      try {
        await this.assertResources(P.ACTIVITY_ENROLLMENT_MANAGE, 'activities', [activityId], 'write')
        const scope = await this.scope(P.ACTIVITY_ENROLLMENT_MANAGE, 'classGroups', 'write')
        candidateScope = { ...scope, clauses: scope.clauses.filter(({ target }) => target.kind === 'school' || (target.kind === 'all' && target.grain === 'activity') || (target.kind === 'activity' && (!target.activityId || target.activityId === activityId))) }
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
      }
      return {
        participants: this.repositories.activityEnrollments.forAccess(participantScope),
        classes: candidateScope ? this.repositories.classGroups.forAccess(candidateScope) : undefined,
        placements: this.repositories.classActivityEnrollments.forAccess({ ...participantScope, resource: 'classActivityEnrollments' }),
        enrollments: this.repositories.enrollments.forSchool!(this.actor.schoolId),
        students: this.repositories.students.forSchool!(this.actor.schoolId),
      }
    },
  }

  readonly assessmentEditor = {
    marks: async () => {
      try {
        return {
          assessments: this.repositories.assessments.forAccess(await this.scope(P.GRADE_READ, 'assessments')),
          results: this.repositories.assessmentResults.forAccess(await this.scope(P.GRADE_READ, 'assessmentResults')),
        }
      }
      catch (error) {
        if (!(error instanceof AuthorizationError))
          throw error
        return undefined
      }
    },
    context: async (input: { classGroupId: string, periodId: string }) => {
      const actions = [P.ASSESSMENT_MANAGE, P.ASSESSMENT_READ, P.GRADE_MANAGE, P.GRADE_READ]
      const scope = await this.assertResources(actions, 'classGroups', [input.classGroupId], 'read')
      const group = await this.repositories.classGroups.forAccess(scope).findById(input.classGroupId)
      const period = await this.repositories.academicPeriods.forSchool!(this.actor.schoolId).findById(input.periodId)
      if (!group || !period || period.academicYearId !== group.academicYearId)
        denied()
      return {
        group,
        period,
        assessments: this.repositories.assessments.forAccess(await this.scope(actions, 'assessments')),
        classSubjects: this.repositories.classSubjects.forAccess(await this.scope(actions, 'classSubjects')),
        enrollments: this.repositories.enrollments.forSchool!(this.actor.schoolId),
        subjects: this.repositories.subjects.forSchool!(this.actor.schoolId),
      }
    },
  }

  readonly grades = {
    readScope: () => this.scope(P.GRADE_READ, 'assessmentResults'),
    assertInput: (target: { assessmentId: string, studentId: string }) => this.assertGradeTargets(P.GRADE_MANAGE, target),
    assertUpdate: (target: { assessmentId: string, studentId: string }) => this.assertGradeTargets(P.GRADE_MANAGE, target),
  }

  readonly attendance = {
    assertRecord: async (input: { classGroupId: string, lessonSessionId?: string, studentId?: string }) => {
      await this.assertResources(P.ATTENDANCE_RECORD, 'classGroups', [input.classGroupId])
      if (input.lessonSessionId)
        await this.assertResources(P.ATTENDANCE_RECORD, 'lessonSessions', [input.lessonSessionId])
      if (input.studentId)
        await this.assertResources(P.ATTENDANCE_RECORD, 'students', [input.studentId])
    },
  }

  readonly enrollments = {
    assertCreate: async (input: { studentId: string, classGroupId: string }) => {
      await this.assertResources(P.ENROLLMENT_MANAGE, 'students', [input.studentId])
      await this.assertResources(P.ENROLLMENT_MANAGE, 'classGroups', [input.classGroupId])
    },
    assertUpdate: async (input: { studentId: string, classGroupId: string }) => {
      await this.assertResources(P.ENROLLMENT_MANAGE, 'students', [input.studentId])
      await this.assertResources(P.ENROLLMENT_MANAGE, 'classGroups', [input.classGroupId])
    },
  }

  readonly guardians = {
    assertLinkStudent: async (input: { guardianId: string, studentId: string }) => {
      await this.assertResources(P.PARENT_MANAGE, 'guardians', [input.guardianId])
      await this.assertResources(P.PARENT_MANAGE, 'students', [input.studentId])
    },
  }

  readonly attachments = {
    assertCleanup: async () => {
      if (this.actor.kind !== 'system' || !['preparePrivateFileCleanup', 'private-file-cleanup'].includes(this.actor.systemId))
        return denied('Private file cleanup requires its internal integration identity')
      await this.assertSchool(P.ATTACHMENT_CONFIGURE)
    },
    assertConfigure: () => this.assertSchool(P.ATTACHMENT_CONFIGURE),
    assertRemove: async (attachment: Attachment) => {
      await this.assertSchool(P.ATTACHMENT_CONFIGURE)
      const scope = await this.scope(P.ATTACHMENT_CONFIGURE, 'attachments', 'write')
      await this.repositories.attachments.forAccess(scope).assertAccess(attachment)
      return scope
    },
    assertRead: (id: string) => this.assertResources(P.ATTACHMENT_READ, 'attachments', [id], 'read'),
  }

  readonly school = {
    assertRegister: () => this.assertSchool(P.PLATFORM_REGISTER_SCHOOL),
    assertConfigureStructure: () => this.assertSchool(P.SCHOOL_CONFIGURE),
    assertManageLifecycle: () => this.assertSchool(P.SCHOOL_LIFECYCLE_MANAGE),
  }

  readonly staffPermissions = {
    assertRead: () => this.assertSchool(P.ACCESS_CONTROL_READ),
    assertAssign: () => this.assertSchool(P.ACCESS_CONTROL_MANAGE),
    assertConfigure: () => this.assertSchool(P.ACCESS_CONTROL_MANAGE),
  }

  readonly subjectParticipation = {
    context: async () => {
      const scope = await this.entity('subjectEnrollments').readScope()
      return {
        subjectEnrollments: this.repositories.subjectEnrollments.forAccess(scope),
        placements: this.repositories.enrollments.forAccess({ ...scope, resource: 'enrollments' }),
        students: this.repositories.students.forAccess({ ...scope, resource: 'students' }),
        classSubjects: this.repositories.classSubjects.forAccess({ ...scope, resource: 'classSubjects' }),
      }
    },
  }

  readonly timetable = {
    studentEventRepositories: async (studentId: string) => {
      const placements = await this.repositories.enrollments.forAccess(await this.scope(P.TIMETABLE_READ, 'enrollments')).list({ studentId })
      if (!placements.length)
        await this.assertResources(P.TIMETABLE_READ, 'students', [studentId], 'read')
      return {
        placements,
        lessonSessions: this.repositories.lessonSessions.forAccess(await this.scope(P.TIMETABLE_READ, 'lessonSessions')),
        activitySessions: this.repositories.activitySessions.forAccess(await this.scope(P.TIMETABLE_READ, 'activitySessions')),
        assessments: this.repositories.assessments.forAccess(await this.scope(P.TIMETABLE_READ, 'assessments')),
        classGroups: this.repositories.classGroups.forSchool!(this.actor.schoolId),
        teacherAssignments: this.repositories.teacherAssignments.forSchool!(this.actor.schoolId),
        teachers: this.repositories.teachers.forSchool!(this.actor.schoolId),
        activities: this.repositories.activities.forSchool!(this.actor.schoolId),
      }
    },
    eventRepositories: async (classGroupId: string) => {
      await this.assertResources(P.TIMETABLE_READ, 'classGroups', [classGroupId], 'read')
      return {
        lessonSessions: this.repositories.lessonSessions.forAccess(await this.scope(P.TIMETABLE_READ, 'lessonSessions')),
        activitySessions: this.repositories.activitySessions.forAccess(await this.scope(P.TIMETABLE_READ, 'activitySessions')),
        assessments: this.repositories.assessments.forAccess(await this.scope(P.TIMETABLE_READ, 'assessments')),
        classGroups: this.repositories.classGroups.forSchool!(this.actor.schoolId),
        teacherAssignments: this.repositories.teacherAssignments.forSchool!(this.actor.schoolId),
        teachers: this.repositories.teachers.forSchool!(this.actor.schoolId),
        activities: this.repositories.activities.forSchool!(this.actor.schoolId),
      }
    },
    teacherEventRepositories: async (teacherId: string) => {
      const teacher = await this.repositories.teachers.forSchool!(this.actor.schoolId).findById(teacherId)
      if (!teacher)
        denied()
      if (this.actor.kind === 'teacher') {
        if (this.actor.teacherId !== teacherId)
          denied()
      }
      else if (this.actor.kind !== 'staff' && this.actor.kind !== 'system' && this.actor.kind !== 's2s') {
        denied()
      }
      return {
        lessonSessions: this.repositories.lessonSessions.forAccess(await this.scope(P.TIMETABLE_READ, 'lessonSessions')),
        activitySessions: this.repositories.activitySessions.forAccess(await this.scope(P.TIMETABLE_READ, 'activitySessions')),
        assessments: this.repositories.assessments.forAccess(await this.scope(P.TIMETABLE_READ, 'assessments')),
        classGroups: this.repositories.classGroups.forSchool!(this.actor.schoolId),
        teacherAssignments: this.repositories.teacherAssignments.forSchool!(this.actor.schoolId),
        teachers: this.repositories.teachers.forSchool!(this.actor.schoolId),
        activities: this.repositories.activities.forSchool!(this.actor.schoolId),
      }
    },
    assertUpdateClass: (id: string) => this.assertResources(P.TIMETABLE_MANAGE, 'classGroups', [id]),
    spaceRepositories: async (input: { classGroupId: string, academicYearId: string }) => {
      const scope = await this.assertResources(P.TIMETABLE_READ, 'classGroups', [input.classGroupId], 'read')
      const classGroup = await this.repositories.classGroups.forAccess(scope).findById(input.classGroupId) ?? denied()
      if (classGroup.academicYearId !== input.academicYearId)
        denied('Timetable availability must use the authorized class academic year')
      const schoolId = this.actor.schoolId
      const academicYearId = classGroup.academicYearId
      return {
        classGroups: this.repositories.classGroups.forAccess(resourceAccessScope(schoolId, 'classGroups', [{ target: { kind: 'records', ids: [classGroup.id] } }])),
        academicYears: this.repositories.academicYears.forAccess(resourceAccessScope(schoolId, 'academicYears', [{ target: { kind: 'records', ids: [academicYearId] } }])),
        periodDefinitions: this.repositories.periodDefinitions.forAccess(resourceAccessScope(schoolId, 'periodDefinitions', [{ target: { kind: 'school' }, academicYearId }])),
        calendarEvents: this.repositories.calendarEvents.forAccess(resourceAccessScope(schoolId, 'calendarEvents', [{ target: { kind: 'class_group', classGroupId: classGroup.id }, academicYearId, calendarAncestors: true }])),
      }
    },
    assertCreateClass: (id: string) => this.assertResources(P.TIMETABLE_MANAGE, 'classGroups', [id]),
    assertGenerate: async (sessions: readonly CoreEntityMap['lessonSessions'][]) => {
      const scope = await this.scope(P.TIMETABLE_MANAGE, 'lessonSessions', 'write')
      for (const session of sessions) {
        const existing = await this.repositories.lessonSessions.forSchool!(this.actor.schoolId).findById(session.id)
        if (existing)
          denied('Generated sessions must have new identities')
        await this.repositories.lessonSessions.forAccess(scope).assertAccess(session)
      }
      return scope
    },
    assertDiscardGenerated: (ids: readonly string[]) => this.assertResources(P.TIMETABLE_MANAGE, 'lessonSessions', ids),
  }

  readonly identities = {
    assertInitializeFixtureOwner: async (staffId: string, before: CoreEntityMap['schools'], after: CoreEntityMap['schools']) => {
      if (this.actor.kind !== 'system' || this.actor.systemId !== 'fixture-seed'
        || before.id !== after.id || before.pendingOwnerStaffId || !after.ownerSubjectId
        || (before.ownerSubjectId && before.ownerSubjectId !== after.ownerSubjectId)) {
        denied('Fixture initialization cannot replace an owner or pending invitation')
      }
      const { ownerSubjectId: _beforeOwner, ...beforeFields } = before.data
      const { ownerSubjectId: _afterOwner, ...afterFields } = after.data
      if (JSON.stringify(beforeFields) !== JSON.stringify(afterFields))
        denied('Fixture owner initialization cannot change school settings')
      const scope = await this.scope(P.ACCESS_CONTROL_MANAGE, 'schools', 'write')
      const staff = await this.facts().one('staffMembers', staffId)
      if (staff.accountKind !== 'human' || !staff.isActive || staff.subjectId !== after.ownerSubjectId)
        denied('Fixture owner must be an active linked human staff member')
      await this.repositories.schools.forAccess(scope).assertAccess(before)
      await this.repositories.schools.forAccess(scope).assertAccess(after)
      return scope
    },
    assertClaimOwner: async (invitation: CoreEntityMap['accountInvitations'], before: CoreEntityMap['schools'], after: CoreEntityMap['schools']) => {
      const scope = await this.scope(P.ACCESS_CONTROL_MANAGE, 'schools', 'write')
      if (invitation.kind !== 'staff' || invitation.schoolId !== before.id || before.id !== after.id
        || before.ownerSubjectId || before.pendingOwnerStaffId !== invitation.targetId || after.pendingOwnerStaffId
        || !after.ownerSubjectId) {
        denied('Ownership can be claimed only through the pending owner invitation')
      }
      const staff = await this.facts().one('staffMembers', invitation.targetId)
      if (staff.accountKind !== 'human' || staff.subjectId !== after.ownerSubjectId)
        denied()
      await this.repositories.schools.forAccess(scope).assertAccess(before)
      await this.repositories.schools.forAccess(scope).assertAccess(after)
      return scope
    },
    assertLink: async <K extends 'staffMembers' | 'teachers' | 'guardians' | 'students'>(resource: K, entity: CoreEntityMap[K], existing: CoreEntityMap[K]) => {
      const scope = await this.scope(P.ACCESS_CONTROL_MANAGE, resource, 'write')
      if (resource === 'staffMembers') {
        const before = existing as CoreEntityMap['staffMembers']
        const after = entity as CoreEntityMap['staffMembers']
        if (before.accountKind === 'service' || after.accountKind === 'service')
          denied('Service identities are managed through service-account commands')
        const school = await this.facts().one('schools', this.actor.schoolId)
        if (school.ownerSubjectId && before.subjectId === school.ownerSubjectId && before.subjectId !== after.subjectId)
          throw new BusinessRuleViolationError('SCHOOL_OWNER_IDENTITY_LINK_BLOCKED', 'Transfer school ownership before changing the owner’s identity link')
      }
      const repository = this.repositories[resource].forAccess(scope) as unknown as BaseRepositoryInterface<CoreEntityMap[K]>
      await repository.assertAccess(existing)
      await repository.assertAccess(entity)
      return scope
    },
  }

  readonly invitations = {
    dispatchScope: async () => {
      await this.assertIntegrationCaller(['invitation-dispatch'])
      return this.scope(P.ACCESS_CONTROL_READ, 'accountInvitations')
    },
    assertAccept: async () => {
      await this.assertIntegrationCaller(['account-invitation-public', 'fixture-seed'])
      await this.assertSchool(P.ACCESS_CONTROL_MANAGE)
    },
    assertUse: (id: string) => this.assertResources([P.ACCESS_CONTROL_MANAGE, P.ACCESS_CONTROL_READ], 'accountInvitations', [id], 'read'),
    assertSave: (invitation: CoreEntityMap['accountInvitations'], existing?: CoreEntityMap['accountInvitations']) => this.assertSave(P.ACCESS_CONTROL_MANAGE, 'accountInvitations', invitation, existing),
  }

  readonly notificationTemplates = {
    assertUpdate: (document: CoreEntityMap['schoolNotificationTemplates'], existing: CoreEntityMap['schoolNotificationTemplates']) => this.assertSave(P.SCHOOL_LIFECYCLE_MANAGE, 'schoolNotificationTemplates', document, existing),
  }

  readonly curriculum = {
    assertImportSubject: async (subject: CoreEntityMap['classSubjects']) => {
      await this.assertIntegrationCaller(['fixture-seed'])
      const existing = await this.repositories.classSubjects.forSchool!(this.actor.schoolId).findById(subject.id)
      return this.entity('classSubjects').assertSave(subject, existing)
    },
    assertImportMatter: async (matter: CoreEntityMap['classSubjectMatters']) => {
      await this.assertIntegrationCaller(['fixture-seed'])
      const existing = await this.repositories.classSubjectMatters.forSchool!(this.actor.schoolId).findById(matter.id)
      return this.entity('classSubjectMatters').assertSave(matter, existing)
    },
    assertConfigure: () => this.assertSchool(P.ACADEMIC_CATALOG_MANAGE),
    assertSyncClass: (id: string) => this.assertResources(P.ACADEMIC_PROGRAM_MANAGE, 'classGroups', [id]),
    assertMirrorSubject: (entity: CoreEntityMap['classSubjects'], existing?: CoreEntityMap['classSubjects']) => this.assertSave(P.ACADEMIC_PROGRAM_MANAGE, 'classSubjects', entity, existing),
    assertMirrorMatter: (entity: CoreEntityMap['classSubjectMatters'], existing?: CoreEntityMap['classSubjectMatters']) => this.assertSave(P.ACADEMIC_PROGRAM_MANAGE, 'classSubjectMatters', entity, existing),
    assertUpdateSubject: (entity: CoreEntityMap['classSubjects'], existing: CoreEntityMap['classSubjects']) => this.assertSave(P.ACADEMIC_PROGRAM_MANAGE, 'classSubjects', entity, existing),
  }

  readonly logbook = {
    assertRecordSession: (id: string) => this.assertResources(P.CLASS_LOGBOOK_MANAGE, 'lessonSessions', [id]),
    assertProgress: async (input: {
      snapshot: CoreEntityMap['classSubjectProgress']
      previousMatter: CoreEntityMap['classSubjectMatters']
      matter: CoreEntityMap['classSubjectMatters']
      previousSubject: CoreEntityMap['classSubjects']
      subject: CoreEntityMap['classSubjects']
    }) => {
      if (input.snapshot.classSubjectMatterId !== input.matter.id || input.matter.classSubjectId !== input.subject.id)
        denied()
      const existing = await this.repositories.classSubjectProgress.forSchool!(this.actor.schoolId).findById(input.snapshot.id)
      if (existing)
        throw new BusinessRuleViolationError('DUPLICATE_PROGRESS_RECORD', 'Progress snapshots cannot be overwritten')
      return {
        snapshot: await this.assertSave(P.CLASS_LOGBOOK_MANAGE, 'classSubjectProgress', input.snapshot),
        matter: await this.assertSave(P.CLASS_LOGBOOK_MANAGE, 'classSubjectMatters', input.matter, input.previousMatter),
        subject: await this.assertSave(P.CLASS_LOGBOOK_MANAGE, 'classSubjects', input.subject, input.previousSubject),
      }
    },
  }

  private async overviewResourceScope(resource: typeof OVERVIEW_RESOURCES[number]): Promise<ResourceAccessScope> {
    const actions: Record<typeof OVERVIEW_RESOURCES[number], Permission> = {
      students: P.STUDENT_READ,
      guardians: P.PARENT_READ,
      staffMembers: P.STAFF_READ,
      teachers: P.STAFF_READ,
      studentCharges: P.PAYMENT_READ,
      results: P.REPORT_CARD_READ,
      incidents: P.DISCIPLINE_READ,
      attendance: P.ATTENDANCE_READ,
      assessments: P.ASSESSMENT_READ,
      assessmentResults: P.GRADE_READ,
      enrollments: P.ENROLLMENT_READ,
      calendarEvents: P.TIMETABLE_READ,
      classGroups: P.CLASS_READ,
      payments: P.PAYMENT_READ,
      studentDisciplinaryActions: P.DISCIPLINE_READ,
      activities: P.ACTIVITY_READ,
      academicPeriods: P.WORKSPACE_ACCESS,
    }
    try {
      return await this.scope(actions[resource], resource)
    }
    catch (error) {
      if (!(error instanceof AuthorizationError))
        throw error
      return resourceAccessScope(this.actor.schoolId, resource, [{ target: { kind: 'records', ids: [] } }])
    }
  }

  readonly overview = {
    assertContext: async (input: { academicYearId?: string, academicPeriodId?: string, classGroupIds?: readonly string[] }) => {
      await this.assertSchool(P.WORKSPACE_ACCESS)
      if (input.academicYearId)
        await this.assertResources(P.WORKSPACE_ACCESS, 'academicYears', [input.academicYearId], 'read')
      if (input.academicPeriodId) {
        await this.assertResources(P.WORKSPACE_ACCESS, 'academicPeriods', [input.academicPeriodId], 'read')
        const period = await this.facts().one('academicPeriods', input.academicPeriodId)
        if (input.academicYearId && period.academicYearId !== input.academicYearId)
          throw new BusinessRuleViolationError('OVERVIEW_PERIOD_YEAR_MISMATCH', 'The overview period must belong to its academic year')
      }
      if (input.classGroupIds?.length)
        await this.assertResources(P.CLASS_READ, 'classGroups', input.classGroupIds, 'read')
    },
    scopes: async (): Promise<DashboardScopes> => {
      const access = this.forOperation()
      return Object.fromEntries(await Promise.all(OVERVIEW_RESOURCES.map(async resource => [resource, await access.overviewResourceScope(resource)]))) as DashboardScopes
    },
    repositories: async (): Promise<OverviewRepositories> => {
      const entries = await Promise.all(OVERVIEW_RESOURCES.map(async resource => [resource, this.repositories[resource].forAccess(await this.overviewResourceScope(resource))] as const))
      return Object.fromEntries(entries) as unknown as OverviewRepositories
    },
  }

  readonly finance = new FinanceAccessPolicy(this)

  readonly logbooks = new LogbookAccessPolicy(this)
  readonly reportCards = new ReportCardAccessPolicy(this)
  readonly documents = new DocumentAccessPolicy(this)
  readonly familyFeedback = new FamilyFeedbackAccessPolicy(this)
}

export function createAccessPolicies(args: { actor: SchoolScopedActorMetadata, repositories: AuthorizationRepositories }): AccessPolicies {
  return new AccessPolicies(args.actor, args.repositories)
}
