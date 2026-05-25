import type { StaffRole } from '../entities/school/staff-member'
import { requireNonBlank, requireValidDate } from '../utils/validation'

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
}

export interface StaffActorMetadata extends InteractiveActorContext {
  readonly kind: 'staff'
  readonly staffMemberId: string
  readonly roles: readonly StaffRole[]
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
  roles: readonly StaffRole[]
}

export interface GuardianActorMetadataInput extends InteractiveActorContextInput {
  guardianId: string
}

export interface StudentActorMetadataInput extends InteractiveActorContextInput {
  studentId: string
}

export interface SystemActorMetadataInput {
  systemId: string
  schoolId: string
  requestId: string
  reason: string
}

export function createStaffActorMetadata(input: StaffActorMetadataInput): StaffActorMetadata {
  const context = normalizeInteractiveContext(input)
  const roles = [...new Set(input.roles)]
  if (roles.length === 0) {
    throw new Error('roles must contain at least one role')
  }
  return Object.freeze({
    ...context,
    kind: 'staff',
    staffMemberId: requireNonBlank(input.staffMemberId, 'staffMemberId'),
    roles: Object.freeze(roles),
  })
}

export function createGuardianActorMetadata(input: GuardianActorMetadataInput): GuardianActorMetadata {
  return Object.freeze({
    ...normalizeInteractiveContext(input),
    kind: 'guardian',
    guardianId: requireNonBlank(input.guardianId, 'guardianId'),
  })
}

export function createStudentActorMetadata(input: StudentActorMetadataInput): StudentActorMetadata {
  return Object.freeze({
    ...normalizeInteractiveContext(input),
    kind: 'student',
    studentId: requireNonBlank(input.studentId, 'studentId'),
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
  switch (actor.kind) {
    case 'staff':
      return actor.staffMemberId
    case 'guardian':
      return actor.guardianId
    case 'student':
      return actor.studentId
    case 'system':
      return actor.systemId
  }
}

export function isInteractiveActor(actor: ActorMetadata): actor is InteractiveActorMetadata {
  return actor.kind !== 'system'
}

function normalizeInteractiveContext(input: InteractiveActorContextInput): InteractiveActorContext {
  return Object.freeze({
    subjectId: requireNonBlank(input.subjectId, 'subjectId'),
    schoolId: requireNonBlank(input.schoolId, 'schoolId'),
    requestId: requireNonBlank(input.requestId, 'requestId'),
    sessionId: input.sessionId ? requireNonBlank(input.sessionId, 'sessionId') : undefined,
    authenticatedAt: requireValidDate(input.authenticatedAt, 'authenticatedAt'),
    assuranceLevel: input.assuranceLevel ?? ActorAssuranceLevel.Standard,
  })
}
