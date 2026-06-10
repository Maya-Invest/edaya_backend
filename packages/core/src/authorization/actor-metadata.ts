import type { EffectiveGrants } from '../ports/authorization-repository'
import { requireNonBlank, requireValidDate } from '../domains/utils'
import { buildPortalScopeGrants } from './portal-grants'
import { GUARDIAN_PORTAL_PERMISSIONS, STUDENT_PORTAL_PERMISSIONS } from './portal-permissions'

export enum ActorAssuranceLevel {
  Standard = 'standard',
  Verified = 'verified',
  Strong = 'strong',
}

export interface InteractiveActorContext {
  readonly subjectId: string
  readonly schoolId: string
  readonly requestId: string
  readonly sessionId?: string
  readonly authenticatedAt: Date
  readonly assuranceLevel: ActorAssuranceLevel
  readonly effectiveGrants: EffectiveGrants
  readonly actorId: string
  readonly kind: 'staff' | 'guardian' | 'student'
}

export interface StaffActorMetadata extends InteractiveActorContext {
  readonly kind: 'staff'
  readonly staffMemberId: string
  readonly effectiveGrants: EffectiveGrants
}

export interface GuardianActorMetadata extends InteractiveActorContext {
  readonly kind: 'guardian'
  readonly guardianId: string
}

export interface StudentActorMetadata extends InteractiveActorContext {
  readonly kind: 'student'
  readonly studentId: string
}

export interface SystemActorMetadata {
  readonly kind: 'system'
  readonly systemId: string
  readonly schoolId: string
  readonly requestId: string
  readonly reason: string
}

export type InteractiveActorMetadata = StaffActorMetadata | GuardianActorMetadata | StudentActorMetadata
export type ActorMetadata = InteractiveActorMetadata | SystemActorMetadata

interface InteractiveActorContextInput {
  subjectId: string
  schoolId: string
  requestId: string
  sessionId?: string
  authenticatedAt: Date
  assuranceLevel?: ActorAssuranceLevel
}

export interface StaffActorMetadataInput extends InteractiveActorContextInput {
  staffMemberId: string
  effectiveGrants: EffectiveGrants
}

export interface GuardianActorMetadataInput extends InteractiveActorContextInput {
  guardianId: string
  effectiveGrants?: EffectiveGrants
}

export interface StudentActorMetadataInput extends InteractiveActorContextInput {
  studentId: string
  effectiveGrants?: EffectiveGrants
}

export interface SystemActorMetadataInput {
  systemId: string
  schoolId: string
  requestId: string
  reason: string
}

export function createStaffActorMetadata(input: StaffActorMetadataInput): StaffActorMetadata {
  const context = normalizeInteractiveContext(input)
  return Object.freeze({
    ...context,
    kind: 'staff',
    actorId: requireNonBlank(input.staffMemberId, 'staffMemberId'),
    staffMemberId: requireNonBlank(input.staffMemberId, 'staffMemberId'),
    effectiveGrants: input.effectiveGrants,
  })
}

export function createGuardianActorMetadata(input: GuardianActorMetadataInput): GuardianActorMetadata {
  const context = normalizeInteractiveContext(input)
  return Object.freeze({
    ...context,
    kind: 'guardian',
    actorId: requireNonBlank(input.guardianId, 'guardianId'),
    guardianId: requireNonBlank(input.guardianId, 'guardianId'),
    effectiveGrants: input.effectiveGrants ?? {
      permissions: GUARDIAN_PORTAL_PERMISSIONS,
      scopeGrants: [],
      isElevated: false,
    },
  })
}

export function createStudentActorMetadata(input: StudentActorMetadataInput): StudentActorMetadata {
  const context = normalizeInteractiveContext(input)
  const studentId = requireNonBlank(input.studentId, 'studentId')
  return Object.freeze({
    ...context,
    kind: 'student',
    actorId: studentId,
    studentId,
    effectiveGrants: input.effectiveGrants ?? {
      permissions: STUDENT_PORTAL_PERMISSIONS,
      scopeGrants: buildPortalScopeGrants(STUDENT_PORTAL_PERMISSIONS, { studentIds: [studentId] }),
      isElevated: false,
    },
  })
}

export function createSystemActorMetadata(input: SystemActorMetadataInput): SystemActorMetadata {
  return Object.freeze({
    kind: 'system',
    systemId: requireNonBlank(input.systemId, 'systemId'),
    schoolId: requireNonBlank(input.schoolId, 'schoolId'),
    requestId: requireNonBlank(input.requestId, 'requestId'),
    reason: requireNonBlank(input.reason, 'reason'),
  })
}

export function resolveAuditActorId(actor: ActorMetadata): string {
  return actor.kind === 'system' ? actor.systemId : actor.actorId
}

export function isInteractiveActor(actor: ActorMetadata): actor is InteractiveActorMetadata {
  return actor.kind !== 'system'
}

function normalizeInteractiveContext(input: InteractiveActorContextInput): Omit<InteractiveActorContext, 'effectiveGrants' | 'actorId' | 'kind'> {
  return Object.freeze({
    subjectId: requireNonBlank(input.subjectId, 'subjectId'),
    schoolId: requireNonBlank(input.schoolId, 'schoolId'),
    requestId: requireNonBlank(input.requestId, 'requestId'),
    sessionId: input.sessionId ? requireNonBlank(input.sessionId, 'sessionId') : undefined,
    authenticatedAt: requireValidDate(input.authenticatedAt, 'authenticatedAt'),
    assuranceLevel: input.assuranceLevel ?? ActorAssuranceLevel.Standard,
  })
}
