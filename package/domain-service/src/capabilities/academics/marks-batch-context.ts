import type { AssessmentResult, BaseRepositoryInterface } from '@edaya/core'
import type { SchoolRepositories } from '../../ports/school-repositories'
import { BusinessRuleViolationError } from '@edaya/core'
import { loadInBatches } from '../shared/bounded-reads'

function cachedById<T extends { readonly id: string }>(repository: BaseRepositoryInterface<T>, rows: readonly T[]): BaseRepositoryInterface<T> {
  const byId = new Map(rows.map(row => [row.id, row]))
  return new Proxy(repository, { get(target, key) {
    if (key === 'findById')
      return async (id: string) => byId.get(id)
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  } })
}

/** Immutable parent facts under the academic-state lock. Marks and hooks remain uncached. */
export async function prepareMarkBatchValidation(results: AssessmentResult[], repositories: SchoolRepositories): Promise<SchoolRepositories> {
  const targets = results.map(row => JSON.stringify([row.assessmentId, row.studentId]))
  if (new Set(targets).size !== targets.length)
    throw new BusinessRuleViolationError('DUPLICATE_ASSESSMENT_MARK', 'A batch cannot contain two marks for the same student and evaluation')
  const assessments = await loadInBatches(results.map(row => row.assessmentId), ids => repositories.assessments.findByIds(ids))
  const groupIds = [...new Set(assessments.map(row => row.classGroupId))]
  const [groups, periods, students, sessions, enrollments, existingMarks, reports] = await Promise.all([
    loadInBatches(groupIds, ids => repositories.classGroups.findByIds(ids)),
    loadInBatches(assessments.map(row => row.periodId), ids => repositories.academicPeriods.findByIds(ids)),
    loadInBatches(results.map(row => row.studentId), ids => repositories.students.findByIds(ids)),
    loadInBatches(assessments.flatMap(row => row.lessonSessionId ? [row.lessonSessionId] : []), ids => repositories.lessonSessions.findByIds(ids)),
    loadInBatches(groupIds, ids => repositories.enrollments.list({ classGroupId: { $in: ids } })),
    loadInBatches(assessments.map(row => row.id), ids => repositories.assessmentResults.list({ assessmentId: { $in: ids } })),
    loadInBatches(results.map(row => row.studentId), ids => repositories.results.list({ studentId: { $in: ids }, periodId: { $in: [...new Set(assessments.map(row => row.periodId))] } })),
  ])
  const cachedEnrollments = new Proxy(repositories.enrollments, { get(target, key) {
    if (key === 'list') {
      return async (filter: { classGroupId?: string }) => {
        if (typeof filter?.classGroupId === 'string' && Object.keys(filter).length === 1)
          return enrollments.filter(row => row.classGroupId === filter.classGroupId)
        return target.list(filter)
      }
    }
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  } })
  const markByTarget = new Map(existingMarks.map(row => [JSON.stringify([row.assessmentId, row.studentId]), row]))
  const reportByTarget = new Map(reports.map(row => [JSON.stringify([row.periodId, row.studentId]), row]))
  const cachedMarks = new Proxy(repositories.assessmentResults, { get(target, key) {
    if (key === 'findOne') {
      return async (filter: { assessmentId?: string, studentId?: string }) => {
        if (typeof filter.assessmentId === 'string' && typeof filter.studentId === 'string' && Object.keys(filter).length === 2)
          return markByTarget.get(JSON.stringify([filter.assessmentId, filter.studentId]))
        return target.findOne(filter)
      }
    }
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  } })
  const cachedReports = new Proxy(repositories.results, { get(target, key) {
    if (key === 'findOne') {
      return async (filter: { periodId?: string, studentId?: string }) => {
        if (typeof filter.periodId === 'string' && typeof filter.studentId === 'string' && Object.keys(filter).length === 2)
          return reportByTarget.get(JSON.stringify([filter.periodId, filter.studentId]))
        return target.findOne(filter)
      }
    }
    const value = Reflect.get(target, key)
    return typeof value === 'function' ? value.bind(target) : value
  } })
  return { ...repositories, assessmentResults: cachedMarks, results: cachedReports, assessments: cachedById(repositories.assessments, assessments), classGroups: cachedById(repositories.classGroups, groups), academicPeriods: cachedById(repositories.academicPeriods, periods), students: cachedById(repositories.students, students), lessonSessions: cachedById(repositories.lessonSessions, sessions), enrollments: cachedEnrollments }
}
