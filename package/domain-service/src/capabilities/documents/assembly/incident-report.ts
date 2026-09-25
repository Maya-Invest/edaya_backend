import type { School } from '@edaya/core'
import type { AssembledDocumentSource, AssembleDocumentInput, DocumentAssemblyContext } from './shared'
import {
  DOCUMENT_FAILURES,
  DocumentSourceType,
} from '@edaya/core'

import { formatDocumentDate } from '../document-format'
import { fail, requireYear } from './shared'

export async function assembleIncidentReport(
  base: DocumentAssemblyContext<'academicYears' | 'classGroups' | 'incidents' | 'studentIncidentInvolvements' | 'students', never>,
  input: AssembleDocumentInput,
  school: School,
  locale: string,
  timeZone: string,
  title: string,
  branding: Record<string, unknown>,
): Promise<AssembledDocumentSource> {
  const incident = await base.repositories.incidents.findById(input.sourceId)
  if (!incident || incident.schoolId !== base.actor.schoolId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Incident was not found')
  const involvements = await base.repositories.studentIncidentInvolvements.list({ incidentId: incident.id })
  const names = await Promise.all(involvements.map(async (involvement) => {
    const student = await base.repositories.students.findById(involvement.studentId)
    return student ? `${student.fullName} (${involvement.role})` : involvement.studentId
  }))
  const classGroup = incident.classGroupId ? await base.repositories.classGroups.findById(incident.classGroupId) : undefined
  const yearId = classGroup?.academicYearId ?? input.academicYearId
  if (!yearId)
    fail(DOCUMENT_FAILURES.SOURCE_MISSING, 'Academic year is required')
  const year = await requireYear(base, yearId)
  const sourceVersion = `${incident.id}:${incident.status}:${incident.updatedAt?.toISOString() ?? incident.createdAt.toISOString()}`
  return {
    academicYearId: year.id,
    sourceType: DocumentSourceType.Incident,
    sourceId: incident.id,
    sourceVersion,
    classGroupId: incident.classGroupId,
    portraitRequired: false,
    snapshot: {
      facts: {
        kind: 'incident-report.v1',
        documentTitle: title,
        schoolName: school.name,
        date: formatDocumentDate(incident.date, locale, timeZone),
        paragraphs: [
          { text: incident.title },
          ...(incident.description ? [{ text: incident.description }] : []),
        ],
        fields: names.map(name => ({ label: locale.startsWith('en') ? 'Involved' : 'Impliqué', value: name })),
      },
      sourceVersion,
      locale: input.locale,
      timeZone,
      ...branding,
    },
  }
}
