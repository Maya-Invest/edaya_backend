import type { DocumentIssuance } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './assembly/shared'
import type { DocumentLocale } from './catalog'
import {
  DOCUMENT_FAILURES,
} from '@edaya/core'
import { assembleAccountDocument } from './assembly/account-document'
import { assembleAnnualReportCard } from './assembly/annual-report-card'
import { assembleAnnualTranscript } from './assembly/annual-transcript'
import { assembleAttendanceSheet } from './assembly/attendance-sheet'
import { assembleClassOperational } from './assembly/class-operational'

import { assembleConvocation } from './assembly/convocation'
import { assembleEnrollmentDocument } from './assembly/enrollment-document'
import { assembleIncidentReport } from './assembly/incident-report'
import { assembleLogbook } from './assembly/logbook'
import { assemblePaymentDocument } from './assembly/payment-document'
import { assembleReportDocument } from './assembly/report-document'
import { fail } from './assembly/shared'
import { assembleStudentIdCard } from './assembly/student-id-card'
import { assembleTeacherTimetable } from './assembly/teacher-timetable'
import { getDocumentTemplateCatalogEntry } from './catalog'

export type { AssembledDocumentSource, AssembleDocumentInput } from './assembly/shared'

/** Rebuild assemble input from the stored issuance so durable render uses the same filters. */
export function assembleInputFromIssuance(issuance: Pick<DocumentIssuance, 'templateKey' | 'sourceId' | 'locale' | 'academicYearId' | 'studentId' | 'classGroupId' | 'snapshot'>): AssembleDocumentInput {
  return {
    templateKey: issuance.templateKey,
    sourceId: issuance.sourceId,
    locale: issuance.locale,
    academicYearId: issuance.academicYearId,
    studentId: issuance.studentId,
    classGroupId: issuance.classGroupId,
    academicPeriodId: issuance.snapshot.academicPeriodId,
    classSubjectId: issuance.snapshot.classSubjectId,
    teacherId: issuance.snapshot.teacherId,
    staffFields: issuance.snapshot.staffFields,
  }
}

function localeTag(locale: DocumentLocale): string {
  return locale === 'en' ? 'en-GB' : 'fr-FR'
}

export async function assembleDocumentSource(base: DocumentAssemblyContext<'documentIssuances' | 'teacherCorrections' | 'academicPeriods' | 'academicYears' | 'allocations' | 'classGroups' | 'enrollments' | 'incidents' | 'lessonSessions' | 'payments' | 'results' | 'schools' | 'studentCharges' | 'studentIncidentInvolvements' | 'studentYearAccounts' | 'students' | 'teachers', 'logbooks' | 'reportCards'>, input: AssembleDocumentInput): Promise<AssembledDocumentSource> {
  const catalog = getDocumentTemplateCatalogEntry(input.templateKey)
  if (!catalog.locales.includes(input.locale))
    fail(DOCUMENT_FAILURES.LOCALE_UNSUPPORTED, `Locale ${input.locale} is not admitted for ${input.templateKey}`)
  const school = await base.repositories.schools.findById(base.actor.schoolId)
  if (!school)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'School was not found')
  const locale = localeTag(input.locale)
  const timeZone = school.timeZone
  const titles = catalog.titles[input.locale]
  const branding = {
    logoAttachmentId: school.logoAttachmentId,
    crestAttachmentId: school.crestAttachmentId,
    stampAttachmentId: school.stampAttachmentId,
    signatureAttachmentId: school.signatureAttachmentId,
    issuanceAssetVersion: school.issuanceAssetVersion,
  }

  switch (input.templateKey) {
    case 'annual-report-card.v1':
      return assembleAnnualReportCard(base, input, school, locale, timeZone, titles, branding)
    case 'report-card.v1':
      return assembleReportDocument(base, input, school, locale, timeZone, titles, branding)
    case 'annual-transcript.v1':
      return assembleAnnualTranscript(base, input, school, locale, timeZone, titles, branding)
    case 'logbook.v1':
      return assembleLogbook(base, input, school, locale, timeZone, titles, branding)
    case 'schooling-certificate.v1':
    case 'enrollment-record.v1':
    case 'withdrawal-certificate.v1':
      return assembleEnrollmentDocument(base, input, school, locale, timeZone, titles, branding)
    case 'student-id-card.v1':
      return assembleStudentIdCard(base, input, school, locale, timeZone, titles, branding)
    case 'invoice.v1':
    case 'account-statement.v1':
    case 'payment-reminder.v1':
      return assembleAccountDocument(base, input, school, locale, timeZone, titles, branding)
    case 'receipt.v1':
    case 'settlement-quittance.v1':
      return assemblePaymentDocument(base, input, school, locale, timeZone, titles, branding)
    case 'convocation.v1':
      return assembleConvocation(base, input, school, locale, timeZone, titles, branding)
    case 'class-timetable.v1':
    case 'class-roster.v1':
      return assembleClassOperational(base, input, school, locale, timeZone, titles, branding)
    case 'teacher-timetable.v1':
      return assembleTeacherTimetable(base, input, school, locale, timeZone, titles, branding)
    case 'attendance-sheet.v1':
      return assembleAttendanceSheet(base, input, school, locale, timeZone, titles, branding)
    case 'incident-report.v1':
      return assembleIncidentReport(base, input, school, locale, timeZone, titles, branding)
    default:
      fail(DOCUMENT_FAILURES.TEMPLATE_UNSUPPORTED, `Unsupported template ${input.templateKey}`)
  }
}
