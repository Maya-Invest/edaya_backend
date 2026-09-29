import type { StaffAccountKind } from '@edaya/core'
import { DomainValidationError } from '@edaya/core'
import { AuthorizationError, AuthorizationErrorCode } from './errors'

/**
 * Interactive assurance for human sessions:
 * - `standard` — no verified primary authentication
 * - `verified` — email or phone OTP completed
 * - `strong` — primary OTP and account-wide authenticator completed
 * - `service` — service-account API keys
 */
export enum ActorAssuranceLevel {
  Standard = 'standard',
  Verified = 'verified',
  Strong = 'strong',
  Service = 'service',
}

export interface InteractiveActorBase {
  readonly subjectId: string
  readonly schoolId: string
  readonly requestId: string
  readonly sessionId?: string
  readonly authenticatedAt: Date
  readonly assuranceLevel: ActorAssuranceLevel
  readonly actorId: string
  readonly academicYearId?: string
}

export interface StaffActorMetadata extends InteractiveActorBase {
  readonly kind: 'staff'
  readonly staffMemberId: string
  readonly accountKind: StaffAccountKind
}

export interface GuardianActorMetadata extends InteractiveActorBase {
  readonly kind: 'guardian'
  readonly guardianId: string
}

export interface StudentActorMetadata extends InteractiveActorBase {
  readonly kind: 'student'
  readonly studentId: string
}

export interface TeacherActorMetadata extends InteractiveActorBase {
  readonly kind: 'teacher'
  readonly teacherId: string
}

export interface SystemActorMetadata {
  readonly kind: 'system'
  readonly systemId: string
  readonly schoolId: string
  readonly requestId: string
  readonly reason: string
}

export interface PlatformActorMetadata {
  readonly kind: 'platform'
  readonly subjectId: string
  readonly actorId: string
  readonly requestId: string
  readonly sessionId?: string
  readonly authenticatedAt: Date
  readonly assuranceLevel: ActorAssuranceLevel
  readonly email: string
}

export interface S2sActorMetadata {
  readonly academicYearId?: string
  readonly kind: 's2s'
  readonly subjectId: string
  readonly actorId: string
  readonly schoolId: string
  readonly requestId: string
  readonly authenticatedAt: Date
  readonly assuranceLevel: ActorAssuranceLevel.Service
  readonly clientId: string
}

export type InteractiveActorMetadata
  = | StaffActorMetadata
    | GuardianActorMetadata
    | StudentActorMetadata
    | TeacherActorMetadata
    | PlatformActorMetadata

export type SchoolScopedActorMetadata
  = | StaffActorMetadata
    | GuardianActorMetadata
    | StudentActorMetadata
    | TeacherActorMetadata
    | SystemActorMetadata
    | S2sActorMetadata

export type ActorMetadata = InteractiveActorMetadata | SystemActorMetadata | S2sActorMetadata

interface InteractiveActorBaseInput {
  subjectId: string
  schoolId: string
  requestId: string
  sessionId?: string
  authenticatedAt: Date
  assuranceLevel?: ActorAssuranceLevel
  academicYearId?: string
}

export interface StaffActorMetadataInput extends InteractiveActorBaseInput {
  staffMemberId: string
  accountKind?: StaffAccountKind
}

export interface GuardianActorMetadataInput extends InteractiveActorBaseInput {
  guardianId: string
}

export interface StudentActorMetadataInput extends InteractiveActorBaseInput {
  studentId: string
}

export interface TeacherActorMetadataInput extends InteractiveActorBaseInput {
  teacherId: string
}

export interface SystemActorMetadataInput {
  systemId: string
  schoolId: string
  requestId: string
  reason: string
}

export interface PlatformActorMetadataInput {
  subjectId: string
  actorId: string
  requestId: string
  sessionId?: string
  authenticatedAt: Date
  assuranceLevel?: ActorAssuranceLevel
  email: string
}

export interface S2sActorMetadataInput {
  actorId: string
  schoolId: string
  requestId: string
  authenticatedAt?: Date
  clientId: string
}

export function createStaffActorMetadata(input: StaffActorMetadataInput): StaffActorMetadata {
  const accountKind = input.accountKind ?? 'human'
  const staffMemberId = requireNonBlank(input.staffMemberId, 'staffMemberId')
  const context = normalizeInteractiveBase({
    ...input,
    assuranceLevel: input.assuranceLevel ?? (accountKind === 'service'
      ? ActorAssuranceLevel.Service
      : ActorAssuranceLevel.Standard),
  })
  return Object.freeze({
    ...context,
    kind: 'staff',
    actorId: staffMemberId,
    staffMemberId,
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
  const guardianId = requireNonBlank(input.guardianId, 'guardianId')
  const context = normalizeInteractiveBase(input)
  return Object.freeze({
    ...context,
    kind: 'guardian',
    actorId: guardianId,
    guardianId,
  })
}

export function createStudentActorMetadata(input: StudentActorMetadataInput): StudentActorMetadata {
  const studentId = requireNonBlank(input.studentId, 'studentId')
  const context = normalizeInteractiveBase(input)
  return Object.freeze({
    ...context,
    kind: 'student',
    actorId: studentId,
    studentId,
  })
}

export function createTeacherActorMetadata(input: TeacherActorMetadataInput): TeacherActorMetadata {
  const teacherId = requireNonBlank(input.teacherId, 'teacherId')
  const context = normalizeInteractiveBase(input)
  return Object.freeze({
    ...context,
    kind: 'teacher',
    actorId: teacherId,
    teacherId,
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

export function createPlatformActorMetadata(input: PlatformActorMetadataInput): PlatformActorMetadata {
  const actorId = requireNonBlank(input.actorId, 'actorId')
  const email = requireNonBlank(input.email, 'email').toLowerCase()
  return Object.freeze({
    kind: 'platform',
    subjectId: requireNonBlank(input.subjectId, 'subjectId'),
    actorId,
    requestId: requireNonBlank(input.requestId, 'requestId'),
    sessionId: input.sessionId ? requireNonBlank(input.sessionId, 'sessionId') : undefined,
    authenticatedAt: requireValidDate(input.authenticatedAt, 'authenticatedAt'),
    assuranceLevel: input.assuranceLevel ?? ActorAssuranceLevel.Standard,
    email,
  })
}

export function createS2sActorMetadata(input: S2sActorMetadataInput): S2sActorMetadata {
  const actorId = requireNonBlank(input.actorId, 'actorId')
  return Object.freeze({
    kind: 's2s',
    subjectId: `s2s:${actorId}`,
    actorId,
    schoolId: requireNonBlank(input.schoolId, 'schoolId'),
    requestId: requireNonBlank(input.requestId, 'requestId'),
    authenticatedAt: requireValidDate(input.authenticatedAt ?? new Date(), 'authenticatedAt'),
    assuranceLevel: ActorAssuranceLevel.Service,
    clientId: requireNonBlank(input.clientId, 'clientId'),
  })
}

export function resolveAuditActorId(actor: ActorMetadata): string {
  return actor.kind === 'system' ? actor.systemId : actor.actorId
}

export function isInteractiveActor(actor: unknown): actor is InteractiveActorMetadata {
  if (typeof actor !== 'object' || actor === null || !('kind' in actor)) {
    return false
  }
  return actor.kind === 'staff'
    || actor.kind === 'guardian'
    || actor.kind === 'student'
    || actor.kind === 'teacher'
    || actor.kind === 'platform'
}

export function isSchoolScopedActor(actor: ActorMetadata): actor is SchoolScopedActorMetadata {
  return actor.kind !== 'platform'
}

export function requireActorSchoolId(actor: ActorMetadata): string {
  if (actor.kind === 'platform') {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden, 'Platform actors are not school-scoped')
  }
  return actor.schoolId
}

function normalizeInteractiveBase(input: InteractiveActorBaseInput): InteractiveActorBase {
  return Object.freeze({
    subjectId: requireNonBlank(input.subjectId, 'subjectId'),
    schoolId: requireNonBlank(input.schoolId, 'schoolId'),
    requestId: requireNonBlank(input.requestId, 'requestId'),
    sessionId: input.sessionId ? requireNonBlank(input.sessionId, 'sessionId') : undefined,
    authenticatedAt: requireValidDate(input.authenticatedAt, 'authenticatedAt'),
    assuranceLevel: input.assuranceLevel ?? ActorAssuranceLevel.Standard,
    actorId: '',
    ...(input.academicYearId ? { academicYearId: requireNonBlank(input.academicYearId, 'academicYearId') } : {}),
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
