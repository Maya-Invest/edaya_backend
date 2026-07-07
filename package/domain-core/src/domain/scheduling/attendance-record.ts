import type { EntityConfigFactory } from '../../application/entities/entity-config'
import type { EntityTenantResolver, EntityWriteAuthorization } from '../../application/entities/managed-entity-service'
import type { AuthorizationPolicy } from '../../capabilities/authorization'
import type { SchoolRepositories } from '../../ports/repositories/school-repositories'
import type { AttendanceAnchor } from './attendance-anchor'
import { z } from 'zod'
import {
  authorizeDeleteWithOperation,
  authorizeSaveWithOperation,
  config,
  dateTime,
  indirectTenant,
  operationModule,
  read,
  unique,
  write,
} from '../../application/entities/entity-config'
import { AttendanceOperations, denyResourceAccess } from '../../capabilities/authorization'
import { BusinessRuleViolationError } from '../../domain/shared/business-rule-error'
import { normalizeDate, parseDomain, zodDate } from '../shared/utils'
import { attendanceAnchorFields, attendanceAnchorKey, refineAttendanceAnchor } from './attendance-anchor'
import { resolveAttendanceRecordSchoolId } from './attendance-record-school'

export enum AttendanceStatus {
  Present = 'present',
  Absent = 'absent',
  Late = 'late',
}

export enum AttendanceJustificationStatus {
  None = 'none',
  Pending = 'pending',
  Excused = 'excused',
  Rejected = 'rejected',
}

export const attendanceRecordBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  studentId: z.string().trim().min(1, 'studentId must not be blank'),
  ...attendanceAnchorFields,
  date: zodDate().transform(normalizeDate),
  status: z.nativeEnum(AttendanceStatus),
  justificationStatus: z.nativeEnum(AttendanceJustificationStatus).default(AttendanceJustificationStatus.None),
  reason: z.string().trim().min(1, 'reason must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  notes: z.string().trim().min(1, 'notes must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  justifiedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  justifiedByStaffId: z.string().trim().min(1, 'justifiedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  correctedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  correctedByStaffId: z.string().trim().min(1, 'correctedByStaffId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdBy: z.string().trim().min(1, 'createdBy must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})

function refineAttendanceRecord(
  data: AttendanceAnchor & {
    status?: AttendanceStatus
    justificationStatus?: AttendanceJustificationStatus
    justifiedByStaffId?: string
    justifiedAt?: Date
    correctedAt?: Date
    correctedByStaffId?: string
  },
  ctx: z.RefinementCtx,
) {
  refineAttendanceAnchor(data, ctx)
  if (data.justifiedByStaffId && !data.justifiedAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'justifiedAt is required when justifiedByStaffId is provided',
    })
  }
  if ((data.correctedAt && !data.correctedByStaffId) || (!data.correctedAt && data.correctedByStaffId)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'correctedAt and correctedByStaffId must be provided together',
    })
  }
  if (
    data.justificationStatus !== AttendanceJustificationStatus.None
    && data.status === AttendanceStatus.Present
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'present attendance must not carry an absence justification',
    })
  }
  if (
    (data.justificationStatus === AttendanceJustificationStatus.Excused
      || data.justificationStatus === AttendanceJustificationStatus.Rejected)
    && (!data.justifiedAt || !data.justifiedByStaffId)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'reviewed justifications must identify the reviewing staff member and time',
    })
  }
}

export const attendanceRecordSchema = attendanceRecordBaseSchema.superRefine(refineAttendanceRecord)

export type AttendanceRecordData = z.infer<typeof attendanceRecordSchema>
export type AttendanceRecordInput = z.input<typeof attendanceRecordSchema>

export const attendanceRecordCreateSchema = attendanceRecordBaseSchema.omit({ createdAt: true, updatedAt: true }).superRefine(refineAttendanceRecord)
export const attendanceRecordUpdateSchema = attendanceRecordBaseSchema.partial().required({ id: true }).superRefine(refineAttendanceRecord)

/**
 * Records the presence, absence, or tardiness of a student on a specific date,
 * anchored to a class-wide attendance occurrence or a lesson/activity/assessment occurrence.
 */
export class AttendanceRecord {
  readonly data: AttendanceRecordData

  constructor(args: AttendanceRecordInput) {
    this.data = parseDomain(attendanceRecordSchema, args)
  }

  get id() { return this.data.id }
  get studentId() { return this.data.studentId }
  get attendanceId() { return this.data.attendanceId }
  get lessonSessionId() { return this.data.lessonSessionId }
  get activitySessionId() { return this.data.activitySessionId }
  get assessmentId() { return this.data.assessmentId }
  get date() { return this.data.date }
  get status() { return this.data.status }
  get justificationStatus() { return this.data.justificationStatus }
  get reason() { return this.data.reason }
  get notes() { return this.data.notes }
  get justifiedAt() { return this.data.justifiedAt }
  get justifiedByStaffId() { return this.data.justifiedByStaffId }
  get correctedAt() { return this.data.correctedAt }
  get correctedByStaffId() { return this.data.correctedByStaffId }
  get createdBy() { return this.data.createdBy }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get anchorKey(): string {
    return attendanceAnchorKey(this.data)
  }

  copyWith(changes: Partial<AttendanceRecordInput>): AttendanceRecord {
    return new AttendanceRecord({
      id: this.id,
      studentId: this.studentId,
      attendanceId: this.attendanceId,
      lessonSessionId: this.lessonSessionId,
      activitySessionId: this.activitySessionId,
      assessmentId: this.assessmentId,
      date: this.date,
      status: this.status,
      justificationStatus: this.justificationStatus,
      reason: this.reason,
      notes: this.notes,
      justifiedAt: this.justifiedAt,
      justifiedByStaffId: this.justifiedByStaffId,
      correctedAt: this.correctedAt,
      correctedByStaffId: this.correctedByStaffId,
      createdBy: this.createdBy,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}

export interface OccurrenceAttendanceSummary {
  present: number
  absent: number
  excusedAbsent: number
  late: number
  total: number
}

export function buildOccurrenceAttendanceSummary(records: AttendanceRecord[], expectedTotal: number): OccurrenceAttendanceSummary {
  const summary: OccurrenceAttendanceSummary = {
    present: 0,
    absent: 0,
    excusedAbsent: 0,
    late: 0,
    total: expectedTotal,
  }

  for (const record of records) {
    if (record.status === AttendanceStatus.Present)
      summary.present += 1
    if (record.status === AttendanceStatus.Absent)
      summary.absent += 1
    if (
      record.status === AttendanceStatus.Absent
      && record.justificationStatus === AttendanceJustificationStatus.Excused
    ) {
      summary.excusedAbsent += 1
    }
    if (record.status === AttendanceStatus.Late)
      summary.late += 1
  }

  return summary
}

export const attendanceRecordConfig: EntityConfigFactory<AttendanceRecord> = ({ repositories, policy, atomicExecution }) =>
  config({
    repository: repositories.attendance,
    tenant: attendanceRecordTenant(),
    read: read(
      operationModule(AttendanceOperations.read),
      async (actor, entities) => {
        await policy.checkStudentAccess(actor, unique(entities.map(entity => entity.studentId)))
      },
    ),
    write: write(
      operationModule(AttendanceOperations.record),
      authorizeSaveWithOperation(
        AttendanceOperations.record,
        resolveAttendanceRecordContext,
        authorizeAttendanceResource(policy),
      ),
      authorizeDeleteWithOperation(
        AttendanceOperations.record,
        (entity, repositories) => resolveAttendanceRecordContext(entity, undefined, repositories),
        authorizeAttendanceDeleteResource(policy),
      ),
    ),
    gates: {
      preSave: validateAttendanceSave,
    },
    atomicExecution,
  })

async function resolveAttendanceRecordContext(
  entity: AttendanceRecord,
  _existing: AttendanceRecord | undefined,
  repositories: SchoolRepositories,
) {
  if (entity.lessonSessionId) {
    const lessonSession = await repositories.lessonSessions.findById(entity.lessonSessionId)
    if (!lessonSession) {
      denyResourceAccess()
    }
    return {
      classSubjectId: lessonSession.classSubjectId,
      classGroupId: lessonSession.classGroupId,
    }
  }
  if (entity.attendanceId) {
    const attendance = await repositories.attendances.findById(entity.attendanceId)
    if (!attendance) {
      denyResourceAccess()
    }
    return { classGroupId: attendance.classGroupId }
  }
  return {}
}

function authorizeAttendanceResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<AttendanceRecord>['authorizeSave'] {
  return async (actor, entity) => {
    await policy.checkAttendanceRecordAccess(actor, [entity])
  }
}

function authorizeAttendanceDeleteResource(
  policy: AuthorizationPolicy,
): EntityWriteAuthorization<AttendanceRecord>['authorizeDelete'] {
  return async (actor, entity) => {
    await policy.checkAttendanceRecordAccess(actor, [entity])
  }
}

function attendanceRecordTenant(): EntityTenantResolver<AttendanceRecord> {
  return indirectTenant(async (entity, repositories) => resolveAttendanceRecordSchoolId(repositories, entity))
}

async function validateAttendanceSave(
  entity: AttendanceRecord,
  existing: AttendanceRecord | undefined,
): Promise<void> {
  if (!existing)
    return

  const existingReviewed = isReviewedJustification(existing.justificationStatus)
  const proposedReviewed = isReviewedJustification(entity.justificationStatus)
  const isCorrection = entity.status !== existing.status
  if (isCorrection && existingReviewed) {
    throw new BusinessRuleViolationError('CORRECT_REVIEWED_ATTENDANCE_BLOCKED', 'Reviewed attendance must not be corrected without a reopen workflow')
  }
  if (!proposedReviewed)
    return

  if (existingReviewed && attendanceJustificationChanged(entity, existing)) {
    throw new BusinessRuleViolationError('JUSTIFICATION_ALREADY_REVIEWED', 'Attendance justification has already been reviewed')
  }
  if (existing.status !== AttendanceStatus.Absent || entity.status !== AttendanceStatus.Absent) {
    throw new BusinessRuleViolationError('JUSTIFICATION_ABSENCE_REQUIRED', 'Only an absent attendance record may receive a justification decision')
  }
  if (!entity.reason || entity.reason.trim().length === 0) {
    throw new BusinessRuleViolationError('JUSTIFICATION_REASON_REQUIRED', 'reason is required for an attendance justification decision')
  }
}

function isReviewedJustification(status: AttendanceJustificationStatus): boolean {
  return status === AttendanceJustificationStatus.Excused
    || status === AttendanceJustificationStatus.Rejected
}

function attendanceJustificationChanged(entity: AttendanceRecord, existing: AttendanceRecord): boolean {
  return entity.justificationStatus !== existing.justificationStatus
    || entity.reason !== existing.reason
    || entity.notes !== existing.notes
    || dateTime(entity.justifiedAt) !== dateTime(existing.justifiedAt)
    || entity.justifiedByStaffId !== existing.justifiedByStaffId
}

export async function findAttendanceRecordByAnchor(
  repositories: SchoolRepositories,
  studentId: string,
  anchor: AttendanceAnchor,
): Promise<AttendanceRecord | undefined> {
  if (anchor.attendanceId) {
    return repositories.attendance.findOne({ studentId, attendanceId: anchor.attendanceId })
  }
  if (anchor.lessonSessionId) {
    return repositories.attendance.findOne({ studentId, lessonSessionId: anchor.lessonSessionId })
  }
  if (anchor.activitySessionId) {
    return repositories.attendance.findOne({ studentId, activitySessionId: anchor.activitySessionId })
  }
  if (anchor.assessmentId) {
    return repositories.attendance.findOne({ studentId, assessmentId: anchor.assessmentId })
  }
  return undefined
}
