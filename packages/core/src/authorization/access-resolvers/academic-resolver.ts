import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { StudentClassEnrollmentStatus } from '../../domains'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'
import { Permission } from '../permissions'
import { staffGrantCoversAny, staffHasAnyPermission } from './grant-resolver'

export async function checkClassGroupAccess(
  actor: ActorMetadata,
  classGroupIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (classGroupIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'student') {
    const enrollments = await repos.enrollments.list({ studentId: actor.studentId, status: StudentClassEnrollmentStatus.Active })
    const activeClassGroupIds = new Set(enrollments.map(e => e.classGroupId))
    const isEnrolled = classGroupIds.every(id => activeClassGroupIds.has(id))
    if (!isEnrolled)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    return
  }

  if (actor.kind === 'guardian') {
    const links = await repos.guardianLinks.list({ guardianId: actor.guardianId })
    const studentIds = links.map(link => link.studentId)
    const activeClassGroups = new Set<string>()
    for (const studentId of studentIds) {
      const enrollments = await repos.enrollments.list({ studentId, status: StudentClassEnrollmentStatus.Active })
      enrollments.forEach(e => activeClassGroups.add(e.classGroupId))
    }
    const allLinked = classGroupIds.every(id => activeClassGroups.has(id))
    if (!allLinked)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    return
  }

  if (actor.kind === 'staff') {
    if (await staffHasAnyPermission(actor, [
      Permission.QUERY_CLASS_DIRECTORY_READ,
      Permission.ACADEMIC_PROGRAM_READ,
      Permission.ACADEMIC_PROGRAM_UPDATE,
    ], repos)) {
      return
    }

    for (const classGroupId of classGroupIds) {
      const canAccessClass = await staffGrantCoversAny(actor, [
        Permission.GRADE_INPUT,
        Permission.ATTENDANCE_RECORD,
        Permission.CLASS_LOGBOOK_CREATE,
        Permission.CLASS_LOGBOOK_UPDATE,
        Permission.DISCIPLINE_CREATE,
      ], 'class_group', classGroupId, repos)
      if (!canAccessClass) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkAssessmentAccess(
  actor: ActorMetadata,
  assessmentIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (assessmentIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  if (actor.kind === 'student' || actor.kind === 'guardian') {
    const classGroupIds = new Set<string>()
    for (const assessmentId of assessmentIds) {
      const assessment = await repos.assessments.findById(assessmentId)
      if (!assessment)
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      classGroupIds.add(assessment.classGroupId)
    }
    await checkClassGroupAccess(actor, Array.from(classGroupIds), repos)
    return
  }

  if (actor.kind === 'staff') {
    if (await staffHasAnyPermission(actor, [
      Permission.GRADE_READ,
      Permission.EXAM_CONFIG_CONFIGURE,
      Permission.QUERY_CURRICULUM_PROGRESS_READ,
    ], repos)) {
      return
    }

    const assessments = await repos.assessments.findByIds(Array.from(assessmentIds))
    if (assessments.length !== assessmentIds.length) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    const classGroupIds = [...new Set(assessments.map(a => a.classGroupId))]
    await checkClassGroupAccess(actor, classGroupIds, repos)
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkReportCardResultAccess(
  actor: ActorMetadata,
  reportCardResultIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (reportCardResultIds.length === 0)
    return
  if (actor.kind === 'system')
    return

  for (const resultId of reportCardResultIds) {
    const result = await repos.results.findById(resultId)
    if (!result)
      continue
    // Resolves permission by checking access to the linked student
    await checkStudentAccess(actor, [result.studentId], repos)
  }
}

// Fallback helper to allow imports from student-resolver without circular deps
async function checkStudentAccess(
  actor: ActorMetadata,
  studentIds: readonly string[],
  repos: SchoolRepositories,
): Promise<void> {
  if (actor.kind === 'student') {
    const isSelf = studentIds.every(id => id === actor.studentId)
    if (!isSelf)
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    return
  }

  if (actor.kind === 'guardian') {
    for (const id of studentIds) {
      const link = await repos.guardianLinks.findOne({ guardianId: actor.guardianId, studentId: id })
      if (!link || link.schoolId !== actor.schoolId) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  if (actor.kind === 'staff') {
    if (await staffHasAnyPermission(actor, [
      Permission.QUERY_STUDENT_DETAIL_READ,
      Permission.STUDENT_READ,
      Permission.STUDENT_UPDATE,
    ], repos)) {
      return
    }

    for (const studentId of studentIds) {
      const enrollments = await repos.enrollments.list({ studentId })
      const activeEnrollment = enrollments.find(e => e.status === StudentClassEnrollmentStatus.Active)
      if (!activeEnrollment) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
      const canAccessClass = await staffGrantCoversAny(actor, [
        Permission.GRADE_INPUT,
        Permission.ATTENDANCE_RECORD,
        Permission.CLASS_LOGBOOK_CREATE,
        Permission.CLASS_LOGBOOK_UPDATE,
        Permission.DISCIPLINE_CREATE,
      ], 'class_group', activeEnrollment.classGroupId, repos)
      if (!canAccessClass) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
