import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'

const id = z.string().trim().min(1)
const optionalDate = zodDate().nullish().transform(value => value ?? undefined)
// Calendar bounds are materialized by the enrollment/calendar workflows under academic-state.
export const subjectEnrollmentPeriodSchema = z.object({
  periodId: id,
  activatedAt: zodDate(),
  startsAt: zodDate(),
  endsAt: zodDate(),
})
export const studentSubjectEnrollmentSchema = z.object({
  id,
  studentClassEnrollmentId: id,
  classSubjectId: id,
  enrolledAt: zodDate(),
  endedAt: optionalDate,
  source: z.enum(['automatic', 'explicit']),
  scope: z.enum(['annual', 'periods']).default('annual'),
  periods: z.array(subjectEnrollmentPeriodSchema).default([]),
  deletedAt: optionalDate,
  deletedBy: id.nullish().transform(value => value ?? undefined),
  revision: z.number().int().nonnegative().default(0),
  createdAt: zodDate().default(() => new Date()),
}).superRefine((value, ctx) => {
  if (value.endedAt && value.endedAt <= value.enrolledAt)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endedAt'], message: 'Enrollment end must be after its start' })
  if (value.scope === 'periods' && !value.periods.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periods'], message: 'Select at least one period' })
  if (value.scope === 'annual' && value.periods.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periods'], message: 'Annual enrollment cannot select periods' })
  if (new Set(value.periods.map(row => row.periodId)).size !== value.periods.length)
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['periods'], message: 'Periods must be unique' })
  if (Boolean(value.deletedAt) !== Boolean(value.deletedBy))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deletedBy'], message: 'Withdrawal requires an actor and timestamp' })
})

export type StudentSubjectEnrollmentData = z.infer<typeof studentSubjectEnrollmentSchema>
export type StudentSubjectEnrollmentInput = z.input<typeof studentSubjectEnrollmentSchema>

/** Current selection only. Tombstones preserve dependencies, not historical eligibility. */
export class StudentSubjectEnrollment {
  readonly data: StudentSubjectEnrollmentData
  constructor(input: StudentSubjectEnrollmentInput) { this.data = parseDomain(studentSubjectEnrollmentSchema, input) }
  get id() { return this.data.id }
  get studentClassEnrollmentId() { return this.data.studentClassEnrollmentId }
  get classSubjectId() { return this.data.classSubjectId }
  get enrolledAt() { return this.data.enrolledAt }
  get endedAt() { return this.data.endedAt }
  get source() { return this.data.source }
  get scope() { return this.data.scope }
  get periods() { return this.data.periods }
  get deletedAt() { return this.data.deletedAt }
  get revision() { return this.data.revision }
  get createdAt() { return this.data.createdAt }

  effectiveAt(at: Date): boolean {
    return !this.deletedAt && this.enrolledAt <= at && (!this.endedAt || at < this.endedAt)
      && (this.scope === 'annual' || this.periods.some(period => period.activatedAt <= at && period.startsAt <= at && at < period.endsAt))
  }

  overlaps(start: Date, end: Date): boolean {
    const from = Math.max(start.getTime(), this.enrolledAt.getTime())
    const until = Math.min(end.getTime(), this.endedAt?.getTime() ?? Infinity)
    return !this.deletedAt && from < until && (this.scope === 'annual' || this.periods.some(period => Math.max(from, period.activatedAt.getTime(), period.startsAt.getTime()) < Math.min(until, period.endsAt.getTime())))
  }
}

const selection = z.discriminatedUnion('scope', [
  z.object({ scope: z.literal('annual') }).strict(),
  z.object({ scope: z.literal('periods'), periodIds: z.array(id).min(1).max(100) }).strict(),
  z.object({ scope: z.literal('none') }).strict(),
])
export const manageStudentSubjectEnrollmentsSchema = z.object({
  requestId: id.max(200),
  expectedRevisions: z.record(z.number().int().nonnegative()),
  operations: z.array(z.object({ studentClassEnrollmentId: id, classSubjectId: id, selection }).strict()).min(1).max(500),
}).strict()
export type ManageStudentSubjectEnrollmentsInput = z.input<typeof manageStudentSubjectEnrollmentsSchema>
