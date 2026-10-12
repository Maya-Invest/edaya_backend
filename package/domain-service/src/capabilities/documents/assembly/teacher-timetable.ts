import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
  OccurrenceStatus,
} from '@edaya/core'
import { loadInBatches } from '../../shared/bounded-reads'

import { formatDocumentDate } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleTeacherTimetable(
  base: DocumentAssemblyContext<'academicYears' | 'classGroups' | 'lessonSessions' | 'teachers', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const teacherId = input.teacherId ?? (base.actor.kind === 'teacher' ? base.actor.teacherId : input.sourceId)
  const teacher = await base.repositories.teachers.findById(teacherId)
  if (!teacher || teacher.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Teacher was not found')
  const yearId = input.academicYearId
  if (!yearId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year is required')
  const year = await requireYear(base, yearId)
  const yearClasses = await base.repositories.classGroups.list({ schoolId: school.id, academicYearId: year.id })
  const sessions = (yearClasses.length ? await base.repositories.lessonSessions.list({ schoolId: school.id, classGroupId: { $in: yearClasses.map(group => group.id) }, timetableGenerated: true, status: { $ne: OccurrenceStatus.Cancelled } }) : [])
    .filter(session => session.timetableTeacherIds.includes(teacher.id))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
  if (sessions.length === 0)
    fail(DOCUMENT_FAILURES.TIMETABLE_EMPTY, 'No timetable sessions exist for this teacher; generate the timetable first')
  const classGroups = new Map((await loadInBatches(sessions.map(session => session.classGroupId), ids => base.repositories.classGroups.findByIds(ids))).map(group => [group.id, group]))
  const sourceVersion = sessions.map(session => `${session.id}:${session.startsAt.toISOString()}:${session.endsAt.toISOString()}:${session.classGroupId}:${session.displayLabel}`).join('|')
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.Teacher,
    sourceId: teacher.id,
    sourceVersion,
    classGroupId: input.classGroupId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'teacher-timetable.v1',
        documentTitle: title,
        schoolName: school.name,
        schoolYear: year.name,
        fields: [{ label: locale.startsWith('en') ? 'Teacher' : 'Enseignant', value: `${teacher.firstName} ${teacher.lastName}` }],
        columns: locale.startsWith('en') ? ['When', 'Class', 'Session'] : ['Quand', 'Classe', 'Séance'],
        rows: await Promise.all(sessions.map(async (session) => {
          const classGroup = classGroups.get(session.classGroupId)
          return { cells: [formatDocumentDate(session.startsAt, locale, timeZone), classGroup?.name ?? session.classGroupId, session.displayLabel] }
        })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      teacherId: teacher.id,
      ...branding,
    },
  }
}
