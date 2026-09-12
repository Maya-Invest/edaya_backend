import { resolveStaffAssignmentTarget, scopesForStaffAssignmentPermission } from './staff-assignment-policy';
import type { BaseRepositoryInterface, CoreEntityKey, CoreEntityMap, Filter, GrantScope, Permission, StaffAssignment } from '@edaya/core';
import type { ActorMetadata, InteractiveActorMetadata } from '../model/actor';
import type { AuthorizationRepositories } from '../ports/authorization-repositories';
import { StudentClassEnrollmentStatus, TeacherAssignmentKind, TeacherAssignmentStatus } from '@edaya/core';
import { AuthorizationError, AuthorizationErrorCode } from '../model/errors';

export function denied(message = 'Access denied'): never {
  throw new AuthorizationError(AuthorizationErrorCode.Forbidden, message)
}

export interface StaffGrant {
  readonly permission: Permission
  readonly scopes: readonly GrantScope[]
  readonly academicYearId: string
  readonly startsAt?: Date
  readonly endsAt?: Date
  readonly source: 'manual' | 'assignment'
  readonly sourceId: string
}

/** Constructed for an operation; never stored on the actor or in a shared cache. */
export class AccessFacts {
  private readonly memo = new Map<string, Promise<unknown>>()

  private remember<T>(key: string, fetch: () => Promise<T>): Promise<T> {
    const found = this.memo.get(key)
    if (found) return found as Promise<T>
    const pending = fetch()
    this.memo.set(key, pending)
    return pending
  }

  constructor(readonly actor: ActorMetadata, readonly repositories: AuthorizationRepositories, readonly now = new Date()) {}

  repository<K extends CoreEntityKey>(key: K): BaseRepositoryInterface<CoreEntityMap[K]> {
    const repo = this.repositories[key]
    if (!repo?.forSchool)
      return denied(`Repository ${key} must enforce school ownership`)
    return repo.forSchool(this.actor.schoolId) as unknown as BaseRepositoryInterface<CoreEntityMap[K]>
  }

  async one<K extends CoreEntityKey>(key: K, id: string): Promise<CoreEntityMap[K]> {
    return this.remember(`one:${key}:${id}`, async () => await this.repository(key).findById(id) ?? denied())
  }

  async list<K extends CoreEntityKey>(key: K, filter: Filter<CoreEntityMap[K]>): Promise<CoreEntityMap[K][]> {
    return this.remember(`list:${key}:${JSON.stringify(filter)}`, () => this.repository(key).list(filter))
  }

  async validateActor(): Promise<void> {
    const actor = this.actor
    if (actor.kind === 'system') return
    if (actor.kind === 'staff') {
      const staff = await this.one('staffMembers', actor.staffMemberId)
      if (!staff.isActive || staff.accountKind !== actor.accountKind
        || (actor.accountKind === 'human' && staff.subjectId !== actor.subjectId)) denied()
    }
    else if (actor.kind === 'teacher') {
      const teacher = await this.one('teachers', actor.teacherId)
      if (!teacher.isActive || teacher.subjectId !== actor.subjectId) denied()
    }
    else if (actor.kind === 'guardian') {
      const guardian = await this.one('guardians', actor.guardianId)
      if (!guardian.hasAccess || guardian.subjectId !== actor.subjectId) denied()
    }
    else {
      const student = await this.one('students', actor.studentId)
      if (student.subjectId !== actor.subjectId) denied()
    }
  }

  async academicYear(): Promise<string | undefined> {
    const selected = this.actor.kind === 'system' ? undefined : this.actor.academicYearId
    if (selected) return (await this.one('academicYears', selected)).id
    return (await this.repository('academicYears').findOne({ status: 'published' }))?.id
  }

  async owner(): Promise<boolean> {
    if (this.actor.kind !== 'staff') return false
    const staff = await this.one('staffMembers', this.actor.staffMemberId)
    if (staff.accountKind === 'service') return staff.serviceElevated
    const school = await this.one('schools', this.actor.schoolId)
    return Boolean(school.ownerSubjectId && school.ownerSubjectId === this.actor.subjectId)
  }

  async staffGrants(action?: Permission, selectedYear?: string): Promise<StaffGrant[]> {
    if (this.actor.kind !== 'staff') return []
    const year = selectedYear ?? await this.academicYear()
    if (!year) return []
    await this.one('academicYears', year)
    const grants = await this.list('staffPermissionAssignments', {
      staffId: this.actor.staffMemberId, academicYearId: year, status: 'active',
      ...(action ? { permission: action } : {}),
    })
    const result: StaffGrant[] = grants.filter(grant => effectiveAt(grant, this.now)).map(grant => ({
      permission: grant.permission, scopes: grant.scopes, academicYearId: grant.academicYearId,
      startsAt: grant.startsAt, endsAt: grant.endsAt, source: 'manual', sourceId: grant.id,
    }))
    const assignments = await this.list('staffAssignments', { staffId: this.actor.staffMemberId, academicYearId: year })
    for (const assignment of assignments) {
      const permissions = assignment.permissions.filter(permission => !action || permission === action)
      if (!permissions.length) continue
      const target = await this.assignmentTarget(assignment)
      for (const permission of permissions) {
        const scopes = scopesForStaffAssignmentPermission(permission, target)
        result.push({ permission, scopes, academicYearId: year, source: 'assignment', sourceId: assignment.id })
      }
    }
    return result
  }

  async assignmentTarget(assignment: StaffAssignment) {
    const target = await resolveStaffAssignmentTarget(assignment, this.repositories)
    if (target.schoolId !== this.actor.schoolId) denied()
    return target
  }

  async teaching(): Promise<{ year: string | undefined, subjects: Array<{ classGroupId: string, classSubjectId: string }>, homerooms: string[] }> {
    if (this.actor.kind !== 'teacher') return { year: undefined, subjects: [], homerooms: [] }
    const year = await this.academicYear()
    if (!year) return { year, subjects: [], homerooms: [] }
    const assignments = (await this.list('teacherAssignments', {
      teacherId: this.actor.teacherId, academicYearId: year, status: TeacherAssignmentStatus.Active,
    })).filter(assignment => effectiveAt(assignment, this.now))
    const subjects: Array<{ classGroupId: string, classSubjectId: string }> = []
    const homerooms: string[] = []
    for (const assignment of assignments) {
      if (assignment.kind === TeacherAssignmentKind.Subject && assignment.classSubjectId) {
        const subject = await this.one('classSubjects', assignment.classSubjectId)
        const group = await this.one('classGroups', subject.classGroupId)
        if (group.academicYearId !== year) denied()
        subjects.push({ classGroupId: group.id, classSubjectId: subject.id })
      }
      if (assignment.kind === TeacherAssignmentKind.Homeroom && assignment.classGroupId) {
        const group = await this.one('classGroups', assignment.classGroupId)
        if (group.academicYearId !== year) denied()
        homerooms.push(group.id)
      }
    }
    return { year, subjects, homerooms: [...new Set(homerooms)] }
  }

  async linkedStudents(): Promise<string[]> {
    if (this.actor.kind === 'student') return [this.actor.studentId]
    if (this.actor.kind !== 'guardian') return []
    const links = await this.list('guardianLinks', { guardianId: this.actor.guardianId })
    return [...new Set(links.map(link => link.studentId))]
  }

  async studentClasses(studentIds: readonly string[]): Promise<string[]> {
    if (!studentIds.length) return []
    const year = await this.academicYear()
    const rows = await this.list('enrollments', { studentId: { $in: [...studentIds] }, status: StudentClassEnrollmentStatus.Active, ...(year ? { academicYearId: year } : {}) })
    return [...new Set(rows.map(row => row.classGroupId))]
  }
}

export function effectiveAt(value: { startsAt?: Date, endsAt?: Date }, now: Date): boolean {
  return (!value.startsAt || value.startsAt <= now) && (!value.endsAt || now < value.endsAt)
}

export function interactive(actor: ActorMetadata): InteractiveActorMetadata {
  return actor.kind === 'system' ? denied() : actor
}
