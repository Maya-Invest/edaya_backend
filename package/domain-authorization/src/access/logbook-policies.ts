import type { BaseRepositoryInterface, CoreEntityKey, CoreEntityMap } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { AssessmentKind, BusinessRuleViolationError, Permission, TeacherAssignmentKind } from '@edaya/core'
import { AccessFacts, denied } from './facts'

export class LogbookAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  private async repository<K extends CoreEntityKey>(resource: K): Promise<BaseRepositoryInterface<CoreEntityMap[K]>> {
    return this.access.repositories[resource].forAccess(await this.access.scope(Permission.CLASS_LOGBOOK_READ, resource)) as unknown as BaseRepositoryInterface<CoreEntityMap[K]>
  }

  async documentContext(input: { classGroupId: string, academicPeriodId?: string, classSubjectId?: string }) {
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const classGroup = await (await this.repository('classGroups')).findById(input.classGroupId) ?? denied()
    const school = await facts.one('schools', classGroup.schoolId)
    const academicYear = await facts.one('academicYears', classGroup.academicYearId)
    const period = input.academicPeriodId ? await facts.one('academicPeriods', input.academicPeriodId) : undefined
    if (period && period.academicYearId !== academicYear.id)
      throw new BusinessRuleViolationError('ACADEMIC_PERIOD_SCOPE_MISMATCH', 'Period belongs to a different academic year')
    const classSubjects = await (await this.repository('classSubjects')).list({ classGroupId: classGroup.id, ...(input.classSubjectId ? { id: input.classSubjectId } : {}) })
    if (input.classSubjectId && !classSubjects.length)
      return denied()
    const classSubjectIds = classSubjects.map(subject => subject.id)
    const lessonSessions = classSubjectIds.length
      ? await (await this.repository('lessonSessions')).list({ classGroupId: classGroup.id, classSubjectId: { $in: classSubjectIds }, ...(period ? { startsAt: { $gte: period.startDate, $lte: period.endDate } } : {}) })
      : []
    const sessionIds = lessonSessions.map(session => session.id)
    const progressRecords = sessionIds.length ? await (await this.repository('classSubjectProgress')).list({ lessonSessionId: { $in: sessionIds } }) : []
    const classSubjectMatters = classSubjectIds.length ? await (await this.repository('classSubjectMatters')).list({ classSubjectId: { $in: classSubjectIds } }) : []
    const subjects = classSubjects.length ? await (await this.repository('subjects')).findByIds([...new Set(classSubjects.map(subject => subject.subjectId))]) : []
    const subjectMatters = classSubjectMatters.length ? await (await this.repository('subjectMatters')).findByIds([...new Set(classSubjectMatters.map(matter => matter.subjectMatterId))]) : []
    const homeworkAssessments = sessionIds.length ? await (await this.repository('assessments')).list({ classGroupId: classGroup.id, kind: AssessmentKind.Homework, lessonSessionId: { $in: sessionIds } }) : []
    const teacherNameByClassSubjectId = new Map<string, string>()
    for (const classSubject of classSubjects) {
      const names = await facts.assignedTeacherNames({ academicYearId: academicYear.id, classGroupId: classGroup.id, kind: TeacherAssignmentKind.Subject, classSubjectId: classSubject.id })
      if (names)
        teacherNameByClassSubjectId.set(classSubject.id, names)
    }
    return { classGroup, school, academicYear, period, classSubjects, lessonSessions, progressRecords, classSubjectMatters, subjects, subjectMatters, homeworkAssessments, teacherNameByClassSubjectId }
  }

  async assertDocumentExport(input: { classGroupId: string, classSubjectIds: readonly string[], lessonSessionIds: readonly string[] }) {
    await this.access.assertResources(Permission.CLASS_LOGBOOK_READ, 'classGroups', [input.classGroupId], 'read')
    if (input.classSubjectIds.length)
      await this.access.assertResources(Permission.CLASS_LOGBOOK_READ, 'classSubjects', input.classSubjectIds, 'read')
    if (input.lessonSessionIds.length)
      await this.access.assertResources(Permission.CLASS_LOGBOOK_READ, 'lessonSessions', input.lessonSessionIds, 'read')
  }
}
