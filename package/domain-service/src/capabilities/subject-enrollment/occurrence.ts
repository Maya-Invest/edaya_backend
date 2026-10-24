import type { Assessment, LessonSession } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { Assessment as AssessmentEntity, BusinessRuleViolationError } from '@edaya/core'
import { assessmentRoster, invalidateAssessmentDrafts } from '../academics/marks-state'
import { loadParticipation, subjectRoster } from './participation'

interface Conflict { kind: string, id: string }
function assertSafe(conflicts: Conflict[]) {
  if (conflicts.length)
    throw new BusinessRuleViolationError('SUBJECT_ENROLLMENT_HISTORY_CONFLICT', 'The new occurrence date or subject would contradict saved marks or attendance', { conflicts })
}

/** Occurrence date or subject changes must preserve saved work. */
export async function assertAssessmentParticipationSafe(assessment: Assessment, repositories: SchoolRepositories, lesson?: LessonSession): Promise<void> {
  const roster = new Set(await assessmentRoster(assessment, lesson ? { ...repositories, lessonSessions: { ...repositories.lessonSessions, findById: async id => id === lesson.id ? lesson : repositories.lessonSessions.findById(id) } } : repositories))
  const [marks, attendance] = await Promise.all([
    repositories.assessmentResults.list({ assessmentId: assessment.id }),
    repositories.attendance.list({ assessmentId: assessment.id }),
  ])
  assertSafe([
    ...marks.filter(row => !roster.has(row.studentId)).map(row => ({ kind: 'mark', id: row.id })),
    ...attendance.filter(row => !roster.has(row.studentId)).map(row => ({ kind: 'attendance', id: row.id })),
  ])
}

export async function reconcileLessonParticipation(lesson: LessonSession, previous: LessonSession, repositories: SchoolRepositories): Promise<void> {
  if (lesson.classSubjectId === previous.classSubjectId && lesson.classGroupId === previous.classGroupId && lesson.startsAt.getTime() === previous.startsAt.getTime())
    return
  const context = await loadParticipation(repositories, [previous.classGroupId, lesson.classGroupId])
  const before = subjectRoster(context, previous.classSubjectId, previous.startsAt)
  const after = new Set(subjectRoster(context, lesson.classSubjectId, lesson.startsAt))
  const [state, attendance, assessments] = await Promise.all([
    repositories.teacherCorrections.state(lesson.schoolId, 'attendance', `lesson:${lesson.id}`),
    repositories.attendance.list({ lessonSessionId: lesson.id }),
    repositories.assessments.list({ lessonSessionId: lesson.id }),
  ])
  const { entries: savedEntries = [] } = state?.payload ?? {}
  const entries = savedEntries as Array<{ studentId: string }>
  const changed = before.length !== after.size || before.some(id => !after.has(id))
  assertSafe([
    ...attendance.filter(row => !after.has(row.studentId)).map(row => ({ kind: 'attendance', id: row.id })),
    ...entries.filter(row => !after.has(row.studentId)).map(row => ({ kind: 'attendance-draft', id: row.studentId })),
    ...state?.locked && changed ? [{ kind: 'lesson', id: lesson.id }] : [],
  ])
  const dependent = assessments.filter(row => !row.dueAt && !row.startsAt)
  for (const assessment of dependent)
    await assertAssessmentParticipationSafe(assessment, repositories, lesson)
  for (const assessment of dependent) {
    await repositories.assessments.save(new AssessmentEntity({ ...assessment.data, marksRevision: assessment.marksRevision + 1 }))
    await invalidateAssessmentDrafts(assessment, repositories)
  }
  await repositories.teacherCorrections.saveState({ ...(state ?? { schoolId: lesson.schoolId, workflow: 'attendance', targetId: `lesson:${lesson.id}`, version: 0, locked: false, payload: {}, history: [] }), version: (state?.version ?? 0) + 1 })
}
