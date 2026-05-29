import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ActorMetadata } from '../actor-metadata'
import { StaffRole } from '../../../entities/school/staff-member'
import { ActorAssuranceLevel } from '../actor-metadata'
import { AuthorizationError, AuthorizationErrorCode } from '../authorization-error'

const elevatedRoles = new Set([StaffRole.Admin, StaffRole.Principal])

const coordinatorActions = new Set<string>([
  'academics.manage_curriculum',
  'setup.manage_lifecycle',
  'academics.record_progress',
  'academics.read_progress',
  'scheduling.manage',
  'attendance.record',
  'attendance.review_justification',
  'attendance.read',
  'behavior.report_incident',
  'behavior.manage_discipline',
  'behavior.read_incidents',
  'resources.manage',
  'resources.read',
  'attachments.manage',
  'attachments.read',
  'assessments.manage_configuration',
  'assessments.record_result',
  'assessments.read_results',
  'assessments.publish_report_card',
  'students.manage_enrollment',
  'students.manage_guardians',
  'students.manage_profile',
  'students.manage_health',
  'students.manage_notes',
  'communications.manage',
  'queries.read_workspace',
  'queries.read_student_detail',
  'queries.read_enrollment_history',
  'queries.read_report_card_detail',
  'queries.read_communications',
  'queries.read_calendar',
  'queries.read_curriculum_progress',
  'queries.read_class_directory',
  'queries.read_class_curriculum',
  'queries.read_timetable',
  'queries.read_attendance',
  'queries.read_guardian_students_admin',
])

export async function checkGlobalAction(
  actor: ActorMetadata,
  action: string,
  repos: SchoolRepositories,
): Promise<void> {
  if (actor.kind !== 'system') {
    const requiredAssurance: Record<string, ActorAssuranceLevel> = {
      'setup.register_school': ActorAssuranceLevel.Strong,
      'setup.manage_lifecycle': ActorAssuranceLevel.Verified,
      'finance.manage': ActorAssuranceLevel.Verified,
      'assessments.publish_report_card': ActorAssuranceLevel.Verified,
      'students.manage_health': ActorAssuranceLevel.Verified,
      'behavior.manage_discipline': ActorAssuranceLevel.Verified,
    }

    const required = requiredAssurance[action]
    if (required) {
      const assuranceRanking: Record<ActorAssuranceLevel, number> = {
        [ActorAssuranceLevel.Standard]: 0,
        [ActorAssuranceLevel.Verified]: 1,
        [ActorAssuranceLevel.Strong]: 2,
      }
      const actorLevel = actor.assuranceLevel ?? ActorAssuranceLevel.Standard
      if (assuranceRanking[actorLevel] < assuranceRanking[required]) {
        throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
      }
    }
  }

  if (actor.kind === 'system')
    return

  if (actor.kind === 'staff') {
    const staffMember = await repos.staffMembers.findById(actor.staffMemberId)
    if (!staffMember || !staffMember.isActive || staffMember.schoolId !== actor.schoolId) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }

    const roles = staffMember.roles
    if (roles.some(role => elevatedRoles.has(role))) {
      return
    }

    if (roles.includes(StaffRole.Coordinator) && coordinatorActions.has(action)) {
      return
    }

    if (roles.includes(StaffRole.Accountant) && (action === 'finance.manage' || action === 'finance.read')) {
      return
    }

    if (roles.includes(StaffRole.Teacher) && (
      action === 'academics.record_progress'
      || action === 'attendance.record'
      || action === 'behavior.report_incident'
      || action === 'assessments.record_result'
      || action === 'students.manage_notes'
    )) {
      return
    }
  }

  if (actor.kind === 'guardian' || actor.kind === 'student') {
    const allowedReadActions = new Set<string>([
      'attendance.read',
      'finance.read',
      'queries.read_student_detail',
      'queries.read_report_card_detail',
      'queries.read_enrollment_history',
      'assessments.read_results',
      'academics.read_progress',
      'queries.read_timetable',
      'queries.read_calendar',
      'queries.read_communications',
      'queries.read_class_curriculum',
    ])
    if (allowedReadActions.has(action)) {
      return
    }
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}

export async function checkModuleAccess(
  actor: ActorMetadata,
  schoolId: string,
  module: string,
  repos: SchoolRepositories,
): Promise<void> {
  if (actor.schoolId !== schoolId) {
    throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
  }
  if (actor.kind === 'system')
    return

  if (actor.kind === 'staff') {
    const staffMember = await repos.staffMembers.findById(actor.staffMemberId)
    if (!staffMember || !staffMember.isActive) {
      throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
    }
    return
  }

  if (actor.kind === 'guardian' && (module === 'attendance' || module === 'finance' || module === 'academics')) {
    return
  }

  if (actor.kind === 'student' && (module === 'attendance' || module === 'finance' || module === 'academics')) {
    return
  }

  throw new AuthorizationError(AuthorizationErrorCode.Forbidden)
}
