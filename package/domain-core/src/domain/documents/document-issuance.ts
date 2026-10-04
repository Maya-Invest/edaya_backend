import { z } from 'zod'
import { parseDomain, zodDate } from '../shared/utils'
import { DOCUMENT_TEMPLATE_KEYS } from './document-template-key'

export enum DocumentIssuanceStatus {
  Requested = 'requested',
  Rendering = 'rendering',
  Ready = 'ready',
  Failed = 'failed',
  Superseded = 'superseded',
  Voided = 'voided',
  Preview = 'preview',
}

export enum DocumentSourceType {
  ReportCardResult = 'report_card_result',
  ClassLogbook = 'class_logbook',
  Enrollment = 'enrollment',
  Student = 'student',
  Payment = 'payment',
  Charge = 'charge',
  StudentYearAccount = 'student_year_account',
  Incident = 'incident',
  ClassGroup = 'class_group',
  Teacher = 'teacher',
  AttendanceDay = 'attendance_day',
  AttendanceSession = 'attendance_session',
  Convocation = 'convocation',
}

export enum DocumentAudience {
  Staff = 'staff',
  Family = 'family',
  Teacher = 'teacher',
}

export const documentIssuanceSnapshotSchema = z.object({
  facts: z.record(z.unknown()),
  sourceVersion: z.string().min(1),
  locale: z.enum(['fr', 'en']),
  timeZone: z.string().min(1),
  currency: z.string().min(1).optional(),
  portraitAttachmentId: z.string().min(1).optional(),
  logoAttachmentId: z.string().min(1).optional(),
  crestAttachmentId: z.string().min(1).optional(),
  stampAttachmentId: z.string().min(1).optional(),
  signatureAttachmentId: z.string().min(1).optional(),
  issuanceAssetVersion: z.number().int().nonnegative().optional(),
  academicPeriodId: z.string().min(1).optional(),
  academicSources: z.array(z.object({
    resultId: z.string().min(1),
    periodId: z.string().min(1),
    sourceVersion: z.string().min(1),
  })).optional(),
  classSubjectId: z.string().min(1).optional(),
  teacherId: z.string().min(1).optional(),
  staffFields: z.object({
    recipient: z.string().min(1).optional(),
    date: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    reason: z.string().min(1).optional(),
  }).optional(),
})
export type DocumentIssuanceSnapshot = z.infer<typeof documentIssuanceSnapshotSchema>

export const documentIssuanceBaseSchema = z.object({
  id: z.string().trim().min(1, 'id must not be blank'),
  schoolId: z.string().trim().min(1, 'schoolId must not be blank'),
  templateKey: z.enum(DOCUMENT_TEMPLATE_KEYS),
  templateVersion: z.string().trim().min(1, 'templateVersion must not be blank'),
  locale: z.enum(['fr', 'en']),
  academicYearId: z.string().trim().min(1, 'academicYearId must not be blank'),
  sourceType: z.nativeEnum(DocumentSourceType),
  sourceId: z.string().trim().min(1, 'sourceId must not be blank'),
  sourceVersion: z.string().trim().min(1, 'sourceVersion must not be blank'),
  studentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  classGroupId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  snapshot: documentIssuanceSnapshotSchema,
  issuerActorId: z.string().trim().min(1, 'issuerActorId must not be blank'),
  audience: z.nativeEnum(DocumentAudience),
  requestId: z.string().trim().min(1, 'requestId must not be blank'),
  number: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  status: z.nativeEnum(DocumentIssuanceStatus).default(DocumentIssuanceStatus.Requested),
  artifactAttachmentId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  artifactSha256: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  artifactSize: z.number().int().positive().nullable().optional().transform(v => v === null ? undefined : v),
  replacesIssuanceId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  replacedByIssuanceId: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  voidedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
  voidReason: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  failureCode: z.string().trim().min(1).nullable().optional().transform(v => v === null ? undefined : v),
  createdAt: zodDate().default(() => new Date()),
  updatedAt: zodDate().nullable().optional().transform(v => v === null ? undefined : v),
})

export const documentIssuanceSchema = documentIssuanceBaseSchema
export type DocumentIssuanceData = z.infer<typeof documentIssuanceSchema>
export type DocumentIssuanceInput = z.input<typeof documentIssuanceSchema>

export class DocumentIssuance {
  readonly data: DocumentIssuanceData

  constructor(args: DocumentIssuanceInput) {
    this.data = parseDomain(documentIssuanceSchema, args)
  }

  get id() { return this.data.id }
  get schoolId() { return this.data.schoolId }
  get templateKey() { return this.data.templateKey }
  get templateVersion() { return this.data.templateVersion }
  get locale() { return this.data.locale }
  get academicYearId() { return this.data.academicYearId }
  get sourceType() { return this.data.sourceType }
  get sourceId() { return this.data.sourceId }
  get sourceVersion() { return this.data.sourceVersion }
  get studentId() { return this.data.studentId }
  get classGroupId() { return this.data.classGroupId }
  get snapshot() { return this.data.snapshot }
  get issuerActorId() { return this.data.issuerActorId }
  get audience() { return this.data.audience }
  get requestId() { return this.data.requestId }
  get number() { return this.data.number }
  get status() { return this.data.status }
  get artifactAttachmentId() { return this.data.artifactAttachmentId }
  get artifactSha256() { return this.data.artifactSha256 }
  get artifactSize() { return this.data.artifactSize }
  get replacesIssuanceId() { return this.data.replacesIssuanceId }
  get replacedByIssuanceId() { return this.data.replacedByIssuanceId }
  get voidedAt() { return this.data.voidedAt }
  get voidReason() { return this.data.voidReason }
  get failureCode() { return this.data.failureCode }
  get createdAt() { return this.data.createdAt }
  get updatedAt() { return this.data.updatedAt }

  get isDownloadable() {
    return this.status === DocumentIssuanceStatus.Ready
  }

  get isFamilyCurrent() {
    return this.status === DocumentIssuanceStatus.Ready
  }

  copyWith(changes: Partial<DocumentIssuanceInput>): DocumentIssuance {
    return new DocumentIssuance({
      id: this.id,
      schoolId: this.schoolId,
      templateKey: this.templateKey,
      templateVersion: this.templateVersion,
      locale: this.locale,
      academicYearId: this.academicYearId,
      sourceType: this.sourceType,
      sourceId: this.sourceId,
      sourceVersion: this.sourceVersion,
      studentId: this.studentId,
      classGroupId: this.classGroupId,
      snapshot: this.snapshot,
      issuerActorId: this.issuerActorId,
      audience: this.audience,
      requestId: this.requestId,
      number: this.number,
      status: this.status,
      artifactAttachmentId: this.artifactAttachmentId,
      artifactSha256: this.artifactSha256,
      artifactSize: this.artifactSize,
      replacesIssuanceId: this.replacesIssuanceId,
      replacedByIssuanceId: this.replacedByIssuanceId,
      voidedAt: this.voidedAt,
      voidReason: this.voidReason,
      failureCode: this.failureCode,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    })
  }
}
