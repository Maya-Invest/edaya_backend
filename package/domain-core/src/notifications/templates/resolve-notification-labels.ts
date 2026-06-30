import type { CalendarEvent } from '../../domains'
import type { SchoolRepositories } from '../../ports'
import { CalendarEventScopeKind } from '../../domains'

export async function resolveClassGroupName(
  repositories: Partial<Pick<SchoolRepositories, 'classGroups'>>,
  classGroupId: string | undefined,
): Promise<string> {
  if (!classGroupId || !repositories.classGroups?.findById) {
    return classGroupId ?? ''
  }

  const classGroup = await repositories.classGroups.findById(classGroupId)
  return classGroup?.name ?? classGroupId
}

export async function resolvePeriodName(
  repositories: Partial<Pick<SchoolRepositories, 'academicPeriods'>>,
  periodId: string | undefined,
): Promise<string> {
  if (!periodId || !repositories.academicPeriods?.findById) {
    return periodId ?? ''
  }

  const period = await repositories.academicPeriods.findById(periodId)
  return period?.name ?? periodId
}

export async function resolveSubjectNameFromClassSubject(
  repositories: Partial<Pick<SchoolRepositories, 'classSubjects' | 'subjects'>>,
  classSubjectId: string | undefined,
): Promise<string> {
  if (!classSubjectId || !repositories.classSubjects?.findById) {
    return classSubjectId ?? ''
  }

  const classSubject = await repositories.classSubjects.findById(classSubjectId)
  if (!classSubject?.subjectId || !repositories.subjects?.findById) {
    return classSubjectId
  }

  const subject = await repositories.subjects.findById(classSubject.subjectId)
  return subject?.name ?? classSubject.subjectId
}

export async function resolveCalendarEventScopeLabel(
  repositories: Partial<Pick<SchoolRepositories, 'classGroups' | 'gradeLevels'>>,
  event: Pick<CalendarEvent, 'scopeKind' | 'scopeId'>,
): Promise<string> {
  switch (event.scopeKind) {
    case CalendarEventScopeKind.School:
      return 'Whole school'
    case CalendarEventScopeKind.ClassGroup:
      return resolveClassGroupName(repositories, event.scopeId)
    case CalendarEventScopeKind.GradeLevel: {
      if (!event.scopeId || !repositories.gradeLevels?.findById) {
        return event.scopeId ?? ''
      }
      const gradeLevel = await repositories.gradeLevels.findById(event.scopeId)
      return gradeLevel?.name ?? event.scopeId
    }
  }
}
