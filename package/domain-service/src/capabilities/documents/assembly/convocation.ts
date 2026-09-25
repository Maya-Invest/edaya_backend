import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'

import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  StudentClassEnrollmentStatus,
} from '@edaya/core'
import { fail, requireYear } from './shared'

export async function assembleConvocation(
  base: DocumentAssemblyContext<'academicYears' | 'enrollments' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const fields = input.staffFields
  if (!fields?.recipient || !fields.date || !fields.location || !fields.reason)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Convocation requires recipient, date, location and reason')
  const student = await base.repositories.students.findById(input.sourceId)
  if (!student || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Student was not found')
  const enrollments = await base.repositories.enrollments.list({ studentId: student.id, status: StudentClassEnrollmentStatus.Active })
  const enrollment = enrollments[0]
  const yearId = enrollment?.academicYearId ?? input.academicYearId
  if (!yearId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year is required')
  const year = await requireYear(base, yearId)
  const sourceVersion = `${fields.recipient}|${fields.date}|${fields.location}|${fields.reason}`
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.Convocation,
    sourceId: student.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: enrollment?.classGroupId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'convocation.v1',
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        schoolYear: year.name,
        fields: [
          { label: locale.startsWith('en') ? 'Recipient' : 'Destinataire', value: fields.recipient },
          { label: locale.startsWith('en') ? 'Date' : 'Date', value: fields.date },
          { label: locale.startsWith('en') ? 'Location' : 'Lieu', value: fields.location },
          { label: locale.startsWith('en') ? 'Reason' : 'Motif', value: fields.reason },
        ],
        paragraphs: [
          { text: locale.startsWith('en') ? `Recipient: ${fields.recipient}` : `Destinataire : ${fields.recipient}` },
          { text: locale.startsWith('en') ? `Date: ${fields.date}` : `Date : ${fields.date}` },
          { text: locale.startsWith('en') ? `Location: ${fields.location}` : `Lieu : ${fields.location}` },
          { text: locale.startsWith('en') ? `Reason: ${fields.reason}` : `Motif : ${fields.reason}` },
        ],
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      staffFields: fields,
      ...branding,
    },
  }
}
