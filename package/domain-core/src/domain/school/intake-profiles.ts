import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'
import { shortNameSchema } from '../shared/visible-identification'

const text = z.string().trim().min(1)
const optionalText = text.nullable().optional().transform(v => v ?? undefined)

export const academicDisciplineSchema = z.object({
  id: text,
  schoolId: text,
  shortName: shortNameSchema.optional(),
  name: text,
  isActive: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})
export type AcademicDisciplineInput = z.input<typeof academicDisciplineSchema>
export type AcademicDisciplineData = z.infer<typeof academicDisciplineSchema>
export class AcademicDiscipline {
  readonly data: AcademicDisciplineData
  constructor(input: AcademicDisciplineInput) { this.data = parseDomain(academicDisciplineSchema, input) }
  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get shortName() { return this.data.shortName }
  get name() { return this.data.name }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
  copyWith(patch: Partial<AcademicDisciplineInput>): AcademicDiscipline { return new AcademicDiscipline({ ...this.data, ...patch }) }
}

export const placementStatusSchema = z.object({
  id: text,
  schoolId: text,
  shortName: shortNameSchema.optional(),
  name: text,
  isActive: z.boolean().default(true),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})
export type PlacementStatusInput = z.input<typeof placementStatusSchema>
export type PlacementStatusData = z.infer<typeof placementStatusSchema>
export class PlacementStatus {
  readonly data: PlacementStatusData
  constructor(input: PlacementStatusInput) { this.data = parseDomain(placementStatusSchema, input) }
  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get shortName() { return this.data.shortName }
  get name() { return this.data.name }
  get isActive() { return this.data.isActive }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
  copyWith(patch: Partial<PlacementStatusInput>): PlacementStatus { return new PlacementStatus({ ...this.data, ...patch }) }
}

export const studentAcademicYearProfileSchema = z.object({
  id: text,
  schoolId: text,
  studentId: text,
  academicYearId: text,
  placementStatusId: optionalText,
  isRepeating: z.boolean().nullable().optional().transform(v => v ?? undefined),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
})
export type StudentAcademicYearProfileInput = z.input<typeof studentAcademicYearProfileSchema>
export type StudentAcademicYearProfileData = z.infer<typeof studentAcademicYearProfileSchema>
export class StudentAcademicYearProfile {
  readonly data: StudentAcademicYearProfileData
  constructor(input: StudentAcademicYearProfileInput) { this.data = parseDomain(studentAcademicYearProfileSchema, input) }
  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get studentId() { return this.data.studentId }
  get academicYearId() { return this.data.academicYearId }
  get placementStatusId() { return this.data.placementStatusId }
  get isRepeating() { return this.data.isRepeating }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
  copyWith(patch: Partial<StudentAcademicYearProfileInput>): StudentAcademicYearProfile { return new StudentAcademicYearProfile({ ...this.data, ...patch }) }
}

export const teacherAcademicYearProfileSchema = z.object({
  id: text,
  schoolId: text,
  teacherId: text,
  academicYearId: text,
  disciplineIds: z.array(text).default([]).refine(ids => new Set(ids).size === ids.length, 'disciplineIds must be unique'),
  declaredHours: z.number().finite().nonnegative().nullable().optional().transform(v => v ?? undefined),
  hoursPeriod: z.enum(['unspecified', 'week', 'month', 'term', 'academic_year', 'other']).default('unspecified'),
  hoursPeriodLabel: optionalText,
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().default(() => new Date()),
}).superRefine((value, ctx) => {
  if ((value.hoursPeriod === 'other') !== Boolean(value.hoursPeriodLabel))
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hoursPeriodLabel'], message: 'A period label is required only for other periods' })
})
export type TeacherAcademicYearProfileInput = z.input<typeof teacherAcademicYearProfileSchema>
export type TeacherAcademicYearProfileData = z.infer<typeof teacherAcademicYearProfileSchema>
export class TeacherAcademicYearProfile {
  readonly data: TeacherAcademicYearProfileData
  constructor(input: TeacherAcademicYearProfileInput) { this.data = parseDomain(teacherAcademicYearProfileSchema, input) }
  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get teacherId() { return this.data.teacherId }
  get academicYearId() { return this.data.academicYearId }
  get disciplineIds() { return this.data.disciplineIds }
  get declaredHours() { return this.data.declaredHours }
  get hoursPeriod() { return this.data.hoursPeriod }
  get hoursPeriodLabel() { return this.data.hoursPeriodLabel }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }
  copyWith(patch: Partial<TeacherAcademicYearProfileInput>): TeacherAcademicYearProfile { return new TeacherAcademicYearProfile({ ...this.data, ...patch }) }
}
