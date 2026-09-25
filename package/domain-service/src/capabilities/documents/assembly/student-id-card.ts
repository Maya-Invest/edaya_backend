import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  StudentClassEnrollmentStatus,
} from '@edaya/core'

import { formatDocumentDate } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleStudentIdCard(
  base: DocumentAssemblyContext<'academicYears' | 'classGroups' | 'enrollments' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const student = await base.repositories.students.findById(input.sourceId)
  if (!student || student.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Student was not found')
  const enrollments = await base.repositories.enrollments.list({ studentId: student.id, status: StudentClassEnrollmentStatus.Active })
  const enrollment = enrollments[0]
  if (!enrollment)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'An active enrollment is required for a student ID card')
  const classGroup = await base.repositories.classGroups.findById(enrollment.classGroupId)
  const year = await requireYear(base, enrollment.academicYearId)
  if (!student.photoAttachmentId)
    fail(input.preview ? DOCUMENT_FAILURES.PREVIEW_REQUIRED : DOCUMENT_FAILURES.ASSET_MISSING, 'An approved portrait is required for a student ID card')
  const sourceVersion = `${student.photoAttachmentId}:${enrollment.id}`
  return {
    academicYearId: enrollment.academicYearId,
    sourceType: DocumentSourceType.Student,
    sourceId: student.id,
    sourceVersion,
    studentId: student.id,
    classGroupId: classGroup?.id,
    portraitRequired: true,
    snapshot: {
      facts: {
        kind: 'student-id-card.v1',
        documentTitle: title,
        schoolName: school.issuingName ?? school.name,
        studentName: student.fullName,
        classLabel: classGroup?.name,
        schoolYear: year.name,
        matricule: student.matricule,
        schoolCity: school.city,
        schoolCode: school.schoolCode,
        fields: [
          { label: locale.startsWith('en') ? 'Date of birth' : 'Né(e) le', value: student.birthDate ? formatDocumentDate(student.birthDate, locale, timeZone) : '—' },
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
