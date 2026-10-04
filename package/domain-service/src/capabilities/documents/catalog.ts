import type { DocumentAudience, DocumentSourceType, DocumentTemplateKey, Permission } from '@edaya/core'
import { DocumentAudience as Audience, DOCUMENT_TEMPLATE_KEYS, Permission as P, DocumentSourceType as Source } from '@edaya/core'

export const REPORT_CARD_TEMPLATE_KEY = 'report-card.v1' as const

export type DocumentLocale = 'fr' | 'en'
export type DocumentAssetSlot = 'portrait' | 'logo' | 'crest' | 'stamp' | 'signature'
export type DocumentAssetRequirement = 'optional' | 'blocking'

export interface DocumentTemplateCatalogEntry {
  readonly templateKey: DocumentTemplateKey
  readonly templateVersion: string
  readonly locales: readonly DocumentLocale[]
  readonly format: 'pdf'
  readonly sourceType: DocumentSourceType
  readonly numberingKind: string | null
  readonly audiences: readonly DocumentAudience[]
  readonly teacherOperational: boolean
  readonly familyDownload: boolean
  readonly assets: Readonly<Partial<Record<DocumentAssetSlot, DocumentAssetRequirement>>>
  readonly issuePermissions: readonly Permission[]
  readonly titles: Readonly<{ fr: string, en: string }>
}

const STAFF = [Audience.Staff] as const
const STAFF_FAMILY = [Audience.Staff, Audience.Family] as const
const STAFF_TEACHER = [Audience.Staff, Audience.Teacher] as const

const CATALOG: Record<DocumentTemplateKey, DocumentTemplateCatalogEntry> = {
  'report-card.v1': {
    templateKey: 'report-card.v1',
    templateVersion: '1.2.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.ReportCardResult,
    numberingKind: 'bulletin',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { portrait: 'optional', logo: 'optional', crest: 'optional', stamp: 'optional', signature: 'optional' },
    issuePermissions: [P.REPORT_CARD_PUBLISH],
    titles: { fr: 'Bulletin trimestriel de notes', en: 'Trimester report card' },
  },
  'logbook.v1': {
    templateKey: 'logbook.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.ClassLogbook,
    numberingKind: null,
    audiences: STAFF_TEACHER,
    teacherOperational: true,
    familyDownload: false,
    assets: { logo: 'optional' },
    issuePermissions: [P.CLASS_LOGBOOK_READ],
    titles: { fr: 'Cahier de texte de classe', en: 'Class teaching logbook' },
  },
  'schooling-certificate.v1': {
    templateKey: 'schooling-certificate.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Enrollment,
    numberingKind: 'schooling-certificate',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', stamp: 'optional', signature: 'optional' },
    issuePermissions: [P.ENROLLMENT_READ, P.QUERY_ENROLLMENT_HISTORY_READ, P.QUERY_STUDENT_DETAIL_READ],
    titles: { fr: 'Certificat de scolarité', en: 'Schooling certificate' },
  },
  'enrollment-record.v1': {
    templateKey: 'enrollment-record.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Enrollment,
    numberingKind: 'enrollment-record',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', portrait: 'optional' },
    issuePermissions: [P.ENROLLMENT_READ, P.QUERY_ENROLLMENT_HISTORY_READ, P.QUERY_STUDENT_DETAIL_READ],
    titles: { fr: 'Fiche d\'inscription', en: 'Enrollment record' },
  },
  'student-id-card.v1': {
    templateKey: 'student-id-card.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Student,
    numberingKind: null,
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { portrait: 'blocking', logo: 'optional' },
    issuePermissions: [P.ENROLLMENT_READ, P.QUERY_STUDENT_DETAIL_READ],
    titles: { fr: 'Carte d\'élève', en: 'Student ID card' },
  },
  'invoice.v1': {
    templateKey: 'invoice.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.StudentYearAccount,
    numberingKind: 'invoice',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', stamp: 'optional' },
    issuePermissions: [P.PAYMENT_READ],
    titles: { fr: 'Facture / avis d\'échéance', en: 'Invoice / payment notice' },
  },
  'receipt.v1': {
    templateKey: 'receipt.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Payment,
    numberingKind: 'receipt',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', stamp: 'optional' },
    issuePermissions: [P.PAYMENT_READ],
    titles: { fr: 'Quittance de paiement', en: 'Payment receipt' },
  },
  'settlement-quittance.v1': {
    templateKey: 'settlement-quittance.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Payment,
    numberingKind: 'settlement-quittance',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', stamp: 'optional' },
    issuePermissions: [P.PAYMENT_READ],
    titles: { fr: 'Quittance de solde', en: 'Settlement quittance' },
  },
  'account-statement.v1': {
    templateKey: 'account-statement.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.StudentYearAccount,
    numberingKind: null,
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional' },
    issuePermissions: [P.FINANCIAL_REPORT_READ],
    titles: { fr: 'Relevé de compte élève', en: 'Student account statement' },
  },
  'payment-reminder.v1': {
    templateKey: 'payment-reminder.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.StudentYearAccount,
    numberingKind: 'payment-reminder',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional' },
    issuePermissions: [P.PAYMENT_READ],
    titles: { fr: 'Relance de paiement', en: 'Payment reminder' },
  },
  'withdrawal-certificate.v1': {
    templateKey: 'withdrawal-certificate.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Enrollment,
    numberingKind: 'withdrawal-certificate',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', stamp: 'optional', signature: 'optional' },
    issuePermissions: [P.ENROLLMENT_READ, P.QUERY_ENROLLMENT_HISTORY_READ],
    titles: { fr: 'Certificat de radiation', en: 'Withdrawal certificate' },
  },
  'annual-transcript.v1': {
    templateKey: 'annual-transcript.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.ReportCardResult,
    numberingKind: 'annual-transcript',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', crest: 'optional' },
    issuePermissions: [P.REPORT_CARD_READ, P.QUERY_REPORT_CARD_DETAIL_READ],
    titles: { fr: 'Relevé annuel', en: 'Annual transcript' },
  },
  'convocation.v1': {
    templateKey: 'convocation.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Convocation,
    numberingKind: 'convocation',
    audiences: STAFF_FAMILY,
    teacherOperational: false,
    familyDownload: true,
    assets: { logo: 'optional', stamp: 'optional' },
    issuePermissions: [P.ENROLLMENT_READ, P.QUERY_STUDENT_DETAIL_READ],
    titles: { fr: 'Convocation', en: 'Convocation' },
  },
  'class-timetable.v1': {
    templateKey: 'class-timetable.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.ClassGroup,
    numberingKind: null,
    audiences: STAFF_TEACHER,
    teacherOperational: true,
    familyDownload: false,
    assets: { logo: 'optional' },
    issuePermissions: [P.QUERY_TIMETABLE_READ],
    titles: { fr: 'Emploi du temps de classe', en: 'Class timetable' },
  },
  'teacher-timetable.v1': {
    templateKey: 'teacher-timetable.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Teacher,
    numberingKind: null,
    audiences: STAFF_TEACHER,
    teacherOperational: true,
    familyDownload: false,
    assets: { logo: 'optional' },
    issuePermissions: [P.QUERY_TIMETABLE_READ],
    titles: { fr: 'Emploi du temps enseignant', en: 'Teacher timetable' },
  },
  'class-roster.v1': {
    templateKey: 'class-roster.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.ClassGroup,
    numberingKind: null,
    audiences: STAFF_TEACHER,
    teacherOperational: true,
    familyDownload: false,
    assets: { logo: 'optional' },
    issuePermissions: [P.QUERY_CLASS_DIRECTORY_READ],
    titles: { fr: 'Liste de classe', en: 'Class roster' },
  },
  'attendance-sheet.v1': {
    templateKey: 'attendance-sheet.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.AttendanceDay,
    numberingKind: null,
    audiences: STAFF_TEACHER,
    teacherOperational: true,
    familyDownload: false,
    assets: { logo: 'optional' },
    issuePermissions: [P.ATTENDANCE_READ],
    titles: { fr: 'Feuille d\'appel', en: 'Attendance sheet' },
  },
  'incident-report.v1': {
    templateKey: 'incident-report.v1',
    templateVersion: '1.0.0',
    locales: ['fr', 'en'],
    format: 'pdf',
    sourceType: Source.Incident,
    numberingKind: null,
    audiences: STAFF,
    teacherOperational: false,
    familyDownload: false,
    assets: { logo: 'optional' },
    issuePermissions: [P.DISCIPLINE_READ],
    titles: { fr: 'Rapport d\'incident', en: 'Incident report' },
  },
}

export function getDocumentTemplateCatalogEntry(key: DocumentTemplateKey): DocumentTemplateCatalogEntry {
  return CATALOG[key]
}

export function listDocumentTemplateCatalog(): readonly DocumentTemplateCatalogEntry[] {
  return DOCUMENT_TEMPLATE_KEYS.map(key => CATALOG[key])
}

export function documentTemplateTitle(key: DocumentTemplateKey, locale: DocumentLocale): string {
  return CATALOG[key].titles[locale]
}

export function documentTemplatesVisibleTo(actorKind: string): readonly DocumentTemplateCatalogEntry[] {
  return listDocumentTemplateCatalog().filter((entry) => {
    if (actorKind === 'guardian' || actorKind === 'student')
      return entry.familyDownload
    if (actorKind === 'teacher')
      return entry.teacherOperational
    return true
  })
}
