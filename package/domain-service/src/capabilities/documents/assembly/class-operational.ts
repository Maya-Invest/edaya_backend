import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  OccurrenceStatus,
  StudentClassEnrollmentStatus,
} from '@edaya/core'
import { loadInBatches } from '../../shared/bounded-reads'

import { formatDocumentDate } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleClassOperational(
  base: DocumentAssemblyContext<'academicYears' | 'classGroups' | 'enrollments' | 'lessonSessions' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const classGroup = await base.repositories.classGroups.findById(input.sourceId)
  if (!classGroup || classGroup.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Class was not found')
  if (input.academicYearId && input.academicYearId !== classGroup.academicYearId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Class does not belong to the selected academic year')
  const year = await requireYear(base, classGroup.academicYearId)
  if (input.templateKey === 'class-timetable.v1') {
    const sessions = (await base.repositories.lessonSessions.list({ classGroupId: classGroup.id, timetableGenerated: true, status: { $ne: OccurrenceStatus.Cancelled } }))
      .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    if (sessions.length === 0)
      fail(DOCUMENT_FAILURES.TIMETABLE_EMPTY, 'No timetable sessions exist for this class; generate its timetable first')
    const sourceVersion = sessions.map(session => `${session.id}:${session.startsAt.toISOString()}:${session.endsAt.toISOString()}:${session.displayLabel}`).join('|')
    return {
      academicYearId: classGroup.academicYearId,
      sourceType: DocumentSourceType.ClassGroup,
      sourceId: classGroup.id,
      sourceVersion,
      classGroupId: classGroup.id,
      portraitRequired: false,
      snapshot: {
        facts: {
          kind: 'class-timetable.v1',
          documentTitle: title,
          schoolName: school.name,
          classLabel: classGroup.name,
          schoolYear: year.name,
          columns: locale.startsWith('en') ? ['When', 'Session'] : ['Quand', 'Séance'],
          rows: sessions.map(session => ({ cells: [formatDocumentDate(session.startsAt, locale, timeZone), session.displayLabel] })),
        },
        sourceVersion,
        locale: input.locale,
        timeZone,
        ...branding,
      },
    }
  }
  const enrollments = await base.repositories.enrollments.list({ classGroupId: classGroup.id, status: StudentClassEnrollmentStatus.Active })
  const students = await loadInBatches(enrollments.map(enrollment => enrollment.studentId), ids => base.repositories.students.findByIds(ids))
  const names = students.filter(Boolean).map(student => student!.fullName).sort((a, b) => a.localeCompare(b, locale))
  const sourceVersion = enrollments.map(enrollment => enrollment.studentId).sort().join(',')
  return {
    academicYearId: classGroup.academicYearId,
    sourceType: DocumentSourceType.ClassGroup,
    sourceId: classGroup.id,
    sourceVersion,
    classGroupId: classGroup.id,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'class-roster.v1',
        documentTitle: title,
        schoolName: school.name,
        classLabel: classGroup.name,
        schoolYear: year.name,
        columns: locale.startsWith('en') ? ['#', 'Student'] : ['N°', 'Élève'],
        rows: names.map((name, index) => ({ cells: [String(index + 1), name] })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}
