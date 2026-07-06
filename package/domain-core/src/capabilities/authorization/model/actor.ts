import type { StaffAccountKind } from '../../../domain/school/staff-account-kind'
import type { GuardianScope, StudentScope, TeacherActorScope } from './actor-scope'
import type { EffectiveGrants } from './effective-grants'
import { DomainValidationError } from '../../../domain/shared/utils'

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
}

export interface StaffActorMetadata extends InteractiveActorBase {
  readonly kind: 'staff'
  readonly staffMemberId: string
  readonly accountKind: StaffAccountKind
  readonly effectiveGrants: EffectiveGrants
}

export interface GuardianActorMetadata extends InteractiveActorBase {
  readonly kind: 'guardian'
  readonly guardianId: string
  readonly guardianScope: GuardianScope
}

export interface StudentActorMetadata extends InteractiveActorBase {
  readonly kind: 'student'
  readonly studentId: string
  readonly studentScope: StudentScope
}

export interface TeacherActorMetadata extends InteractiveActorBase {
  readonly kind: 'teacher'
  readonly teacherId: string
  readonly teacherScope: TeacherActorScope
}

export interface SystemActorMetadata {
  readonly kind: 'system'
  readonly systemId: string
  readonly schoolId: string
  readonly requestId: string
  readonly reason: string
}

export type InteractiveActorMetadata
  = | StaffActorMetadata
    | GuardianActorMetadata
    | StudentActorMetadata
    | TeacherActorMetadata

export type ActorMetadata = InteractiveActorMetadata | SystemActorMetadata

interface InteractiveActorBaseInput {
  subjectId: string
  schoolId: string
  requestId: string
  sessionId?: string
  authenticatedAt: Date
  assuranceLevel?: ActorAssuranceLevel
}

export interface StaffActorMetadataInput extends InteractiveActorBaseInput {
  staffMemberId: string
  accountKind?: StaffAccountKind
  effectiveGrants: EffectiveGrants
}

export interface GuardianActorMetadataInput extends InteractiveActorBaseInput {
  guardianId: string
  guardianScope: GuardianScope
}

export interface StudentActorMetadataInput extends InteractiveActorBaseInput {
  studentId: string
  studentScope: StudentScope
}

export interface TeacherActorMetadataInput extends InteractiveActorBaseInput {
  teacherId: string
  teacherScope: TeacherActorScope
}

export interface SystemActorMetadataInput {
  systemId: string
  schoolId: string
  requestId: string
  reason: string
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
    effectiveGrants: input.effectiveGrants,
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
    guardianScope: input.guardianScope,
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
    studentScope: input.studentScope,
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
    teacherScope: input.teacherScope,
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
  return actor.kind === 'staff'
    || actor.kind === 'guardian'
    || actor.kind === 'student'
    || actor.kind === 'teacher'
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
