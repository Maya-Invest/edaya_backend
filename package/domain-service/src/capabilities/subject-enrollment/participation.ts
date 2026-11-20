import type { StudentClassEnrollment, StudentSubjectEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { loadInBatches } from '../shared/bounded-reads'

export function placementEffectiveAt(row: StudentClassEnrollment, at: Date): boolean {
  return row.enrolledAt <= at && (!row.endedAt || at < row.endedAt)
}

export interface ParticipationContext {
  placements: Map<string, StudentClassEnrollment>
  enrollments: StudentSubjectEnrollment[]
}

/** One bounded set of reads for all subjects in a workspace; never a read per student. */
export async function loadParticipation(repositories: Pick<SchoolRepositories, 'enrollments' | 'subjectEnrollments'>, classGroupIds: readonly string[]): Promise<ParticipationContext> {
  const placements = await loadInBatches([...new Set(classGroupIds)], ids => repositories.enrollments.list({ classGroupId: { $in: ids } }))
  const enrollments = await loadInBatches(placements.map(row => row.id), ids => repositories.subjectEnrollments.list({ studentClassEnrollmentId: { $in: ids } }))
  return { placements: new Map(placements.map(row => [row.id, row])), enrollments }
}

export function subjectRoster(context: ParticipationContext, classSubjectId: string, at: Date): string[] {
  return [...new Set(context.enrollments.flatMap((row) => {
    const placement = context.placements.get(row.studentClassEnrollmentId)
    return row.classSubjectId === classSubjectId && row.effectiveAt(at) && placement && placementEffectiveAt(placement, at) ? [placement.studentId] : []
  }))].sort()
}

export function enrolledDuring(row: StudentSubjectEnrollment, start: Date, end: Date): boolean {
  return row.overlaps(start, end)
}
