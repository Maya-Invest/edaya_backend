import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  EnrollmentEndReason,
  StudentClassEnrollmentStatus,
} from '@edaya/core'

import { formatDocumentDate } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleEnrollmentDocument(
  base: DocumentAssemblyContext<'academicYears' | 'classGroups' | 'enrollments' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const enrollment = await base.repositories.enrollments.findById(input.sourceId)
  if (!enrollment)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Enrollment was not found')
  const student = await base.repositories.students.findById(enrollment.studentId)
  const classGroup = await base.repositories.classGroups.findById(enrollment.classGroupId)
  const year = await requireYear(base, enrollment.academicYearId)
  if (year.status !== 'published')
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'Official enrollment documents require a published academic year')
  if (!student || !classGroup || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_INACCESSIBLE, 'Enrollment is not accessible')
  if (input.templateKey === 'withdrawal-certificate.v1') {
    if (enrollment.status !== StudentClassEnrollmentStatus.Closed || enrollment.endReason !== EnrollmentEndReason.Withdrawn)
      fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Radiation requires a completed withdrawal')
  }
  else if (enrollment.status !== StudentClassEnrollmentStatus.Active && input.templateKey === 'schooling-certificate.v1') {
    fail(DOCUMENT_FAILURES.SOURCE_UNPUBLISHED, 'A schooling certificate requires an active enrollment')
  }
  const paragraphs = input.templateKey === 'withdrawal-certificate.v1'
    ? [{ text: locale.startsWith('en')
        ? `${student.fullName} was withdrawn from ${school.issuingName ?? school.name} on ${enrollment.endedAt ? formatDocumentDate(enrollment.endedAt, locale, timeZone) : '—'}.`
        : `${student.fullName} a été radié(e) de ${school.issuingName ?? school.name} le ${enrollment.endedAt ? formatDocumentDate(enrollment.endedAt, locale, timeZone) : '—'}.` }]
    : [{ text: locale.startsWith('en')
        ? `${student.fullName} is enrolled at ${school.issuingName ?? school.name} for ${year.name}.`
        : `${student.fullName} est scolarisé(e) à ${school.issuingName ?? school.name} pour ${year.name}.` }]
  const sourceVersion = `${enrollment.status}:${enrollment.endReason ?? ''}:${enrollment.endedAt?.toISOString() ?? ''}:${enrollment.enrolledAt?.toISOString() ?? ''}:${student.fullName}:${student.identifier}`
  return {
    academicYearId: enrollment.academicYearId,
    sourceType: DocumentSourceType.Enrollment,
    sourceId: enrollment.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: input.templateKey,
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        classLabel: classGroup.name,
        schoolYear: year.name,
        // Immutable v1 renderer contract; the live domain uses identifier.
        matricule: student.identifier,
        date: formatDocumentDate(new Date(), locale, timeZone),
        schoolCity: school.city,
        schoolAddress: school.postalAddress,
        schoolPhone: school.phone,
        schoolCode: school.schoolCode,
        paragraphs,
        fields: [
          { label: locale.startsWith('en') ? 'Class' : 'Classe', value: classGroup.name },
          { label: locale.startsWith('en') ? 'Status' : 'Statut', value: enrollment.status },
          ...(enrollment.endReason ? [{ label: locale.startsWith('en') ? 'Reason' : 'Motif', value: enrollment.endReason }] : []),
        ],
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      portraitAttachmentId: student.photoAttachmentId,
      ...branding,
    },
  }
}
