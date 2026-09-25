import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  StudentClassEnrollmentStatus,
} from '@edaya/core'

import { formatDocumentIsoDate } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleAttendanceSheet(
  base: DocumentAssemblyContext<'academicYears' | 'classGroups' | 'enrollments' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const [classGroupId, day] = input.sourceId.includes(':') ? input.sourceId.split(':', 2) as [string, string] : [input.sourceId, formatDocumentIsoDate(new Date(), timeZone)]
  const classGroup = await base.repositories.classGroups.findById(classGroupId)
  if (!classGroup || classGroup.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Class was not found')
  const year = await requireYear(base, classGroup.academicYearId)
  const enrollments = await base.repositories.enrollments.list({ classGroupId: classGroup.id, status: StudentClassEnrollmentStatus.Active })
  const students = await Promise.all(enrollments.map(enrollment => base.repositories.students.findById(enrollment.studentId)))
  const names = students.filter(Boolean).map(student => student!.fullName).sort((a, b) => a.localeCompare(b, locale))
  const sourceVersion = `${classGroup.id}:${day}:${names.join(',')}`
  return {
    academicYearId: classGroup.academicYearId,
    sourceType: DocumentSourceType.AttendanceDay,
    sourceId: `${classGroup.id}:${day}`,
    sourceVersion,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'attendance-sheet.v1',
        documentTitle: title,
        schoolName: school.name,
        classLabel: classGroup.name,
        schoolYear: year.name,
        date: day,
        columns: locale.startsWith('en') ? ['Student', 'Present', 'Absent'] : ['Élève', 'Présent', 'Absent'],
        rows: names.map(name => ({ cells: [name, '☐', '☐'] })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}
