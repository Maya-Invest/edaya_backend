import type { StaffAccountKind } from '../../../domain/school/staff-account-kind'
import type { EffectiveGrants } from './effective-grants'
import { DomainValidationError } from '../../../domain/shared/utils'

export enum ActorAssuranceLevel {
  Standard = 'standard',
  Verified = 'verified',
  Strong = 'strong',
  Service = 'service',
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
  readonly accountKind: StaffAccountKind
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
  effectiveGrants: EffectiveGrants
}

export interface StaffActorMetadataInput extends InteractiveActorContextInput {
  staffMemberId: string
  accountKind?: StaffAccountKind
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
  const accountKind = input.accountKind ?? 'human'
  const context = normalizeInteractiveContext({
    ...input,
    assuranceLevel: input.assuranceLevel ?? (accountKind === 'service'
      ? ActorAssuranceLevel.Service
      : ActorAssuranceLevel.Standard),
  })
  return Object.freeze({
    ...context,
    kind: 'staff',
    actorId: requireNonBlank(input.staffMemberId, 'staffMemberId'),
    staffMemberId: requireNonBlank(input.staffMemberId, 'staffMemberId'),
    accountKind,
  })
}

export function createServiceStaffActorMetadata(
  input: Omit<StaffActorMetadataInput, 'accountKind' | 'assuranceLevel'>,
): StaffActorMetadata {
  return createStaffActorMetadata({
    ...input,
    accountKind: 'service',
    assuranceLevel: ActorAssuranceLevel.Service,
  })
}

export function createGuardianActorMetadata(input: GuardianActorMetadataInput): GuardianActorMetadata {
  const context = normalizeInteractiveContext(input)
  return Object.freeze({
    ...context,
    kind: 'guardian',
    actorId: requireNonBlank(input.guardianId, 'guardianId'),
    guardianId: requireNonBlank(input.guardianId, 'guardianId'),
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

export function isInteractiveActor(actor: unknown): actor is InteractiveActorMetadata {
  if (typeof actor !== 'object' || actor === null || !('kind' in actor)) {
    return false
  }
  return actor.kind === 'staff' || actor.kind === 'guardian' || actor.kind === 'student'
}

function normalizeInteractiveContext(input: InteractiveActorContextInput): Omit<InteractiveActorContext, 'actorId' | 'kind'> {
  return Object.freeze({
    subjectId: requireNonBlank(input.subjectId, 'subjectId'),
    schoolId: requireNonBlank(input.schoolId, 'schoolId'),
    requestId: requireNonBlank(input.requestId, 'requestId'),
    sessionId: input.sessionId ? requireNonBlank(input.sessionId, 'sessionId') : undefined,
    authenticatedAt: requireValidDate(input.authenticatedAt, 'authenticatedAt'),
    assuranceLevel: input.assuranceLevel ?? ActorAssuranceLevel.Standard,
    effectiveGrants: input.effectiveGrants,
  })
}

function requireNonBlank(value: string, fieldName: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new DomainValidationError(`${fieldName} must not be blank`)
  }
  return trimmed
}

function requireValidDate(value: Date, fieldName: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new DomainValidationError(`${fieldName} must be a valid date`)
  }
  return value
}
