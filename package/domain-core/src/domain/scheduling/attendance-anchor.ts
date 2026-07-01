import { z } from 'zod'

export const attendanceAnchorFields = {
  attendanceId: z.string().trim().min(1, 'attendanceId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  lessonSessionId: z.string().trim().min(1, 'lessonSessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  activitySessionId: z.string().trim().min(1, 'activitySessionId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
  assessmentId: z.string().trim().min(1, 'assessmentId must not be blank').nullable().optional().transform(v => v === null ? undefined : v),
}

export interface AttendanceAnchor {
  attendanceId?: string
  lessonSessionId?: string
  activitySessionId?: string
  assessmentId?: string
}

export function refineAttendanceAnchor(data: AttendanceAnchor, ctx: z.RefinementCtx): void {
  const anchors = [data.attendanceId, data.lessonSessionId, data.activitySessionId, data.assessmentId].filter(Boolean)
  if (anchors.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one of attendanceId, lessonSessionId, activitySessionId, or assessmentId is required',
    })
  }
}

export function attendanceAnchorKey(data: AttendanceAnchor): string {
  return data.attendanceId
    ?? data.lessonSessionId
    ?? data.activitySessionId
    ?? data.assessmentId
    ?? ''
}
