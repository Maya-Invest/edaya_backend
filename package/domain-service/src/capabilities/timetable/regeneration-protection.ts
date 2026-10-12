import type { LessonSession } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { OccurrenceStatus } from '@edaya/core'
import { loadInBatches } from '../shared/bounded-reads'

/** Called under the academic-state lock, before deleting any generated sessions. */
export async function regeneratableSessionIds(repositories: SchoolRepositories, schoolId: string, sessions: readonly LessonSession[]): Promise<string[]> {
  const candidates = sessions.filter(session => session.timetableGenerated
    && session.schoolId === schoolId
    && session.status === OccurrenceStatus.Pending
    && !session.isException
    && !session.sessionNote)
  const ids = candidates.map(session => session.id)
  const protectedIds = new Set(await loadInBatches(ids, async (batch) => {
    const filter = { lessonSessionId: { $in: batch } }
    const references = await Promise.all([
      repositories.attendance.list(filter),
      repositories.classSubjectProgress.list(filter),
      repositories.assessments.list(filter),
      repositories.incidents.list(filter),
      repositories.staffAssignments.list(filter),
      repositories.resourceAssignments.list(filter),
    ])
    const workflowIds = await repositories.teacherCorrections.referencedLessonSessionIds(schoolId, batch)
    return [...workflowIds, ...references.flat().flatMap(row => row.lessonSessionId ? [row.lessonSessionId] : [])]
  }))
  return ids.filter(id => !protectedIds.has(id))
}
