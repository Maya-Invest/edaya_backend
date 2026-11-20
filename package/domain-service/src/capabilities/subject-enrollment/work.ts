import type { ClassGroup, ClassSubject, ReportCardResultSection, StudentSubjectEnrollment } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { Assessment, ReportCardResult, ReportCardResultStatus } from '@edaya/core'
import { invalidateAssessmentDrafts } from '../academics/marks-state'
import { loadInBatches } from '../shared/bounded-reads'

/** One work snapshot per offering/batch, shared across all student operations. */
export async function loadSubjectWork(repositories: SchoolRepositories, classSubjectId: string) {
  const offering = await repositories.classSubjects.findById(classSubjectId)
  const group = offering ? await repositories.classGroups.findById(offering.classGroupId) : undefined
  if (!offering || !group)
    throw new Error('Subject offering not found')
  const [assessments, lessons, placements, periods] = await Promise.all([
    repositories.assessments.list({ classSubjectId }),
    repositories.lessonSessions.list({ classSubjectId }),
    repositories.enrollments.list({ classGroupId: group.id }),
    repositories.academicPeriods.list({ academicYearId: group.academicYearId }),
  ])
  const [marks, lessonAttendance, assessmentAttendance, states, reports] = await Promise.all([
    loadInBatches(assessments.map(row => row.id), ids => repositories.assessmentResults.list({ assessmentId: { $in: ids } })),
    loadInBatches(lessons.map(row => row.id), ids => repositories.attendance.list({ lessonSessionId: { $in: ids } })),
    loadInBatches(assessments.map(row => row.id), ids => repositories.attendance.list({ assessmentId: { $in: ids } })),
    Promise.all(lessons.map(row => repositories.teacherCorrections.state(group.schoolId, 'attendance', `lesson:${row.id}`))),
    loadInBatches(placements.map(row => row.studentId), ids => repositories.results.list({ studentId: { $in: ids } })),
  ])
  const periodIds = new Set(periods.map(row => row.id))
  return { offering, group, assessments, lessons, marks, attendance: [...lessonAttendance, ...assessmentAttendance], states, reports: reports.filter(row => periodIds.has(row.periodId)) }
}
export type SubjectWork = Awaited<ReturnType<typeof loadSubjectWork>>

export type SubjectInvalidationWork = Pick<SubjectWork, 'offering' | 'group' | 'assessments' | 'lessons' | 'reports'>

/** A placement transaction needs invalidation evidence, not withdrawal/deletion evidence. */
export async function loadPlacementInvalidationWork(repositories: SchoolRepositories, group: ClassGroup, offerings: ClassSubject[], studentId: string): Promise<Map<string, SubjectInvalidationWork>> {
  if (!offerings.length)
    return new Map()
  const ids = offerings.map(row => row.id)
  const [assessments, lessons, periods, reports] = await Promise.all([
    loadInBatches(ids, chunk => repositories.assessments.list({ classSubjectId: { $in: chunk } })),
    loadInBatches(ids, chunk => repositories.lessonSessions.list({ classSubjectId: { $in: chunk } })),
    repositories.academicPeriods.list({ academicYearId: group.academicYearId }),
    repositories.results.list({ studentId }),
  ])
  const periodIds = new Set(periods.map(row => row.id))
  const relevantReports = reports.filter(row => periodIds.has(row.periodId))
  return new Map(offerings.map(offering => [offering.id, { offering, group, assessments: assessments.filter(row => row.classSubjectId === offering.id), lessons: lessons.filter(row => row.classSubjectId === offering.id), reports: relevantReports }]))
}

export function hasSubjectDependencies(work: SubjectWork, studentId: string): boolean {
  const contains = (sections: readonly ReportCardResultSection[]): boolean => sections.some(row => row.classSubjectId === work.offering.id || contains(row.subResults))
  return work.marks.some(row => row.studentId === studentId)
    || work.attendance.some(row => row.studentId === studentId)
    || work.assessments.some(row => row.marksStatus !== 'draft' && row.marksReview.rosterStudentIds.includes(studentId))
    || work.states.some((state) => {
      const { entries: savedEntries = [], rosterStudentIds = [] } = state?.payload ?? {}
      const entries = savedEntries as Array<{ studentId: string }>
      const roster = rosterStudentIds as string[]
      return entries.some(row => row.studentId === studentId) || Boolean(state?.locked && roster.includes(studentId))
    })
    || work.reports.some(row => row.studentId === studentId && row.status === ReportCardResultStatus.Published && contains(row.sectionResults))
}

/** Saved work survives selection changes; revision changes force stale editors to reload. */
export async function invalidateSubjectWork(repositories: SchoolRepositories, work: SubjectInvalidationWork, studentId: string, previous?: StudentSubjectEnrollment, next?: StudentSubjectEnrollment) {
  const changed = (at: Date) => Boolean(previous?.effectiveAt(at)) !== Boolean(next?.effectiveAt(at))
  const lessons = new Map(work.lessons.map(row => [row.id, row]))
  for (const snapshot of work.assessments) {
    const at = snapshot.dueAt ?? snapshot.startsAt ?? (snapshot.lessonSessionId ? lessons.get(snapshot.lessonSessionId)?.startsAt : undefined)
    if (snapshot.marksStatus !== 'draft' || !at || !changed(at))
      continue
    const current = await repositories.assessments.findById(snapshot.id)
    if (current) {
      await repositories.assessments.save(new Assessment({ ...current.data, marksRevision: current.marksRevision + 1 }))
      await invalidateAssessmentDrafts(current, repositories)
    }
  }
  for (const lesson of work.lessons.filter(row => changed(row.startsAt))) {
    const state = await repositories.teacherCorrections.state(work.group.schoolId, 'attendance', `lesson:${lesson.id}`)
    if (!state?.locked)
      await repositories.teacherCorrections.saveState({ ...(state ?? { schoolId: work.group.schoolId, workflow: 'attendance', targetId: `lesson:${lesson.id}`, version: 0, locked: false, payload: {}, history: [] }), version: (state?.version ?? 0) + 1 })
  }
  for (const snapshot of work.reports.filter(row => row.studentId === studentId && row.status === ReportCardResultStatus.Draft)) {
    const current = await repositories.results.findById(snapshot.id)
    if (current)
      await repositories.results.save(new ReportCardResult({ ...current.data, sectionResults: [...current.sectionResults], calculationStale: true, version: current.version + 1, rank: undefined }))
  }
}
