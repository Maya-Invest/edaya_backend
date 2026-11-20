import type { AccessFacts } from './facts'
import { ActivityEnrollmentStatus, StudentClassEnrollmentStatus, StudentStatus } from '@edaya/core'

interface StudentFilter { studentId?: { $in: string[] } }

/** Resolve the same live roster when scheduling and dispatching an activity reminder. */
export async function activityReminderStudentIds(
  facts: AccessFacts,
  activityId: string,
  candidates?: string[],
): Promise<string[]> {
  if (candidates?.length === 0)
    return []

  const candidateFilter: StudentFilter = candidates ? { studentId: { $in: candidates } } : {}
  const [individual, byClass] = await Promise.all([
    facts.list('activityEnrollments', { activityId, status: ActivityEnrollmentStatus.Approved, ...candidateFilter }),
    classActivityStudentIds(facts, activityId, candidateFilter),
  ])
  const ids = [...new Set([...individual.map(row => row.studentId), ...byClass])]
  if (!ids.length)
    return []
  const students = await facts.list('students', { id: { $in: ids }, status: StudentStatus.Active })
  return students.map(row => row.id)
}

async function classActivityStudentIds(facts: AccessFacts, activityId: string, candidateFilter: StudentFilter): Promise<string[]> {
  const placements = await facts.list('classActivityEnrollments', { activityId })
  if (!placements.length)
    return []
  const year = await facts.repository('academicYears').findOne({ status: 'published' })
  if (!year)
    return []
  const groups = await facts.list('classGroups', {
    id: { $in: [...new Set(placements.map(row => row.classGroupId))] },
    academicYearId: year.id,
  })
  if (!groups.length)
    return []
  const enrollments = await facts.list('enrollments', {
    classGroupId: { $in: groups.map(row => row.id) },
    academicYearId: year.id,
    status: StudentClassEnrollmentStatus.Active,
    ...candidateFilter,
  })
  return enrollments.map(row => row.studentId)
}
