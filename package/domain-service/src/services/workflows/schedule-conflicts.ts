import type { Assessment, LessonSession, TeacherAssignment } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { AssessmentKind, BusinessRuleViolationError, OccurrenceStatus, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core'
import { teacherUnavailabilityOverlaps } from './teacher-unavailability'

export interface SessionConflictInput {
  classGroupId: string
  teacherIds?: string[]
  startsAt: Date
  endsAt: Date
  excludeSessionId?: string
  excludeActivitySessionId?: string
  excludeAssessmentId?: string
}

export interface ClassGroupScheduleConflictInput {
  classGroupId: string
  startsAt: Date
  endsAt: Date
  excludeLessonSessionId?: string
  excludeActivitySessionId?: string
  excludeAssessmentId?: string
}

function overlaps(startsAt: Date, endsAt: Date, otherStartsAt: Date, otherEndsAt: Date): boolean {
  return startsAt < otherEndsAt && otherStartsAt < endsAt
}

function assignmentApplies(
  assignment: TeacherAssignment,
  teacherIds: Set<string>,
  startsAt: Date,
  endsAt: Date,
): boolean {
  return assignment.kind === TeacherAssignmentKind.Subject
    && assignment.status === TeacherAssignmentStatus.Active
    && Boolean(assignment.classSubjectId)
    && teacherIds.has(assignment.teacherId)
    && (!assignment.startsAt || assignment.startsAt < endsAt)
    && (!assignment.endsAt || startsAt < assignment.endsAt)
}

function assertNoLessonOverlap(
  lessons: Iterable<LessonSession>,
  input: SessionConflictInput,
  teacherConflictIds: Set<string>,
): void {
  for (const lesson of lessons) {
    if (lesson.id === input.excludeSessionId || lesson.status === OccurrenceStatus.Cancelled) {
      continue
    }
    if (!overlaps(input.startsAt, input.endsAt, lesson.startsAt, lesson.endsAt)) {
      continue
    }
    const conflictKind = teacherConflictIds.has(lesson.id) ? 'teacher' : 'class group'
    throw new BusinessRuleViolationError(
      'SCHEDULE_CONFLICT',
      `Occurrence has a ${conflictKind} conflict with lesson session ${lesson.id}`,
    )
  }
}

function assertNoAssessmentOverlap(
  assessments: Iterable<Assessment>,
  input: SessionConflictInput,
  teacherConflictIds: Set<string>,
): void {
  for (const assessment of assessments) {
    if (assessment.id === input.excludeAssessmentId
      || assessment.kind === AssessmentKind.Homework
      || !assessment.startsAt
      || !assessment.endsAt
      || !overlaps(input.startsAt, input.endsAt, assessment.startsAt, assessment.endsAt)) {
      continue
    }
    const conflictKind = teacherConflictIds.has(assessment.id) ? 'teacher' : 'class group'
    throw new BusinessRuleViolationError(
      'SCHEDULE_CONFLICT',
      `Occurrence has a ${conflictKind} conflict with assessment ${assessment.id}`,
    )
  }
}

export async function assertNoSessionConflict(
  repositories: Pick<SchoolRepositories, 'lessonSessions' | 'activitySessions' | 'assessments' | 'teacherUnavailabilities' | 'teacherAssignments'>,
  input: SessionConflictInput,
): Promise<void> {
  const [classLessons, classActivities, classAssessments] = await Promise.all([
    repositories.lessonSessions.list({ classGroupId: input.classGroupId }),
    repositories.activitySessions.list({ classGroupId: input.classGroupId }),
    repositories.assessments.list({ classGroupId: input.classGroupId }),
  ])

  const teacherIds = new Set(input.teacherIds ?? [])
  const teacherLessons: LessonSession[] = []
  const teacherAssessments: Assessment[] = []

  if (teacherIds.size > 0) {
    const unavailabilities = await repositories.teacherUnavailabilities.list({
      teacherId: { $in: [...teacherIds] },
      isActive: true,
    })
    const unavailable = unavailabilities.find(rule => teacherUnavailabilityOverlaps(rule, input.startsAt, input.endsAt))
    if (unavailable) {
      throw new BusinessRuleViolationError(
        'TEACHER_UNAVAILABLE',
        `Teacher ${unavailable.teacherId} is unavailable during this occurrence (${unavailable.id})`,
      )
    }

    const [assignments, generatedLessons] = await Promise.all([
      repositories.teacherAssignments.list({
        kind: TeacherAssignmentKind.Subject,
        status: TeacherAssignmentStatus.Active,
      }),
      repositories.lessonSessions.list({
        startsAt: { $lt: input.endsAt },
        endsAt: { $gt: input.startsAt },
      }),
    ])
    const classSubjectIds = [...new Set(assignments
      .filter(assignment => assignmentApplies(assignment, teacherIds, input.startsAt, input.endsAt))
      .map(assignment => assignment.classSubjectId!))]

    if (classSubjectIds.length > 0) {
      const [lessons, assessments] = await Promise.all([
        repositories.lessonSessions.list({ classSubjectId: { $in: classSubjectIds } }),
        repositories.assessments.list({ classSubjectId: { $in: classSubjectIds } }),
      ])
      teacherLessons.push(...lessons)
      teacherAssessments.push(...assessments)
    }
    teacherLessons.push(...generatedLessons.filter(lesson =>
      lesson.timetableTeacherIds.some(teacherId => teacherIds.has(teacherId))))
  }

  const teacherLessonIds = new Set(teacherLessons.map(lesson => lesson.id))
  const lessons = new Map([...classLessons, ...teacherLessons].map(lesson => [lesson.id, lesson]))
  assertNoLessonOverlap(lessons.values(), input, teacherLessonIds)

  for (const activity of classActivities) {
    if (activity.id === input.excludeActivitySessionId || activity.status === OccurrenceStatus.Cancelled) {
      continue
    }
    if (overlaps(input.startsAt, input.endsAt, activity.startsAt, activity.endsAt)) {
      throw new BusinessRuleViolationError(
        'SCHEDULE_CONFLICT',
        `Occurrence has a class group conflict with activity session ${activity.id}`,
      )
    }
  }

  const teacherAssessmentIds = new Set(teacherAssessments.map(assessment => assessment.id))
  const assessments = new Map([...classAssessments, ...teacherAssessments].map(assessment => [assessment.id, assessment]))
  assertNoAssessmentOverlap(assessments.values(), input, teacherAssessmentIds)
}

export async function assertNoClassGroupScheduleConflict(
  repositories: Pick<SchoolRepositories, 'lessonSessions' | 'activitySessions' | 'assessments' | 'teacherUnavailabilities' | 'teacherAssignments'>,
  input: ClassGroupScheduleConflictInput,
): Promise<void> {
  await assertNoSessionConflict(repositories, {
    classGroupId: input.classGroupId,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    excludeSessionId: input.excludeLessonSessionId,
    excludeActivitySessionId: input.excludeActivitySessionId,
    excludeAssessmentId: input.excludeAssessmentId,
  })
}
