import type { ConversationPlacement, ConversationReadScope } from '@edaya/core'
import type { AccessPolicies } from './access-policies'
import { Permission, StudentClassEnrollmentStatus, StudentStatus, TeacherAssignmentStatus } from '@edaya/core'
import { AuthorizationError } from '../model/errors'
import { AccessFacts, denied } from './facts'

export class ConversationAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}
  private facts() { return new AccessFacts(this.access.actor, this.access.repositories) }
  async staffCan(action: Permission): Promise<boolean> {
    if (this.access.actor.kind !== 'staff' || this.access.actor.accountKind !== 'human')
      return false
    try {
      await this.access.assertSchool(action)
      return true
    }
    catch (error) {
      if (error instanceof AuthorizationError)
        return false
      throw error
    }
  }

  async family(guardianId: string, studentId?: string, facts = this.facts()): Promise<boolean> {
    const guardian = await facts.repository('guardians').findById(guardianId)
    if (!guardian?.hasAccess || !guardian.subjectId)
      return false
    const links = await facts.list('guardianLinks', { guardianId })
    for (const link of links.filter(row => !studentId || row.studentId === studentId)) {
      const student = await facts.repository('students').findById(link.studentId)
      if (student?.status !== StudentStatus.Active)
        continue
      const enrollments = await facts.list('enrollments', { studentId: link.studentId, status: StudentClassEnrollmentStatus.Active })
      if (enrollments.length)
        return true
    }
    return false
  }

  async teaching(row: ConversationPlacement, facts = this.facts()): Promise<boolean> {
    if (!row.teacherId || !row.studentId)
      return false
    const teacher = await facts.repository('teachers').findById(row.teacherId)
    if (!teacher?.isActive || !teacher.subjectId)
      return false
    const enrollments = await facts.list('enrollments', { studentId: row.studentId, status: StudentClassEnrollmentStatus.Active })
    for (const assignmentId of row.assignmentIds) {
      const assignment = await facts.repository('teacherAssignments').findById(assignmentId)
      if (!assignment || assignment.teacherId !== teacher.id || assignment.status !== TeacherAssignmentStatus.Active
        || (assignment.startsAt && assignment.startsAt > facts.now) || (assignment.endsAt && assignment.endsAt <= facts.now)) {
        continue
      }
      const subject = assignment.classSubjectId ? await facts.repository('classSubjects').findById(assignment.classSubjectId) : undefined
      const classId = assignment.classGroupId ?? subject?.classGroupId
      if (classId && enrollments.some(e => e.classGroupId === classId && e.academicYearId === assignment.academicYearId))
        return true
    }
    return false
  }

  async assertRead(row: ConversationPlacement): Promise<void> {
    const actor = this.access.actor
    await this.facts().validateActor()
    if (row.schoolId !== actor.schoolId)
      denied()
    if (actor.kind === 'guardian' && actor.guardianId === row.guardianId && await this.family(actor.guardianId, row.studentId))
      return
    if (actor.kind === 'teacher' && actor.teacherId === row.teacherId && await this.teaching(row))
      return
    if (await this.staffCan(row.destination === 'school' ? Permission.SCHOOL_MESSAGES_READ : Permission.TEACHER_MESSAGES_REVIEW))
      return
    denied()
  }

  async assertReply(row: ConversationPlacement): Promise<void> {
    await this.assertRead(row)
    const actor = this.access.actor
    if (!await this.family(row.guardianId, row.studentId))
      denied('The guardian no longer has family access')
    if (row.destination === 'teacher') {
      if ((actor.kind !== 'guardian' && actor.kind !== 'teacher') || !await this.teaching(row))
        denied('The original teaching relationship is no longer available')
    }
    else if (actor.kind === 'staff' && !await this.staffCan(Permission.SCHOOL_MESSAGES_REPLY)) {
      denied('School reply permission is required')
    }
  }

  async assertResolve(row: ConversationPlacement) {
    await this.assertRead(row)
    if (row.destination !== 'school' || !await this.staffCan(Permission.SCHOOL_MESSAGES_REPLY))
      denied()
  }

  async readScope(rows: readonly ConversationPlacement[]): Promise<ConversationReadScope> {
    const actor = this.access.actor
    await this.facts().validateActor()
    if (actor.kind !== 'guardian' && actor.kind !== 'teacher' && actor.kind !== 'staff')
      denied()
    const ids: string[] = []
    const facts = this.facts()
    if (actor.kind === 'staff') {
      const school = await this.staffCan(Permission.SCHOOL_MESSAGES_READ)
      const oversight = await this.staffCan(Permission.TEACHER_MESSAGES_REVIEW)
      ids.push(...rows.filter(row => row.schoolId === actor.schoolId && (row.destination === 'school' ? school : oversight)).map(row => row.id))
    }
    else {
      for (const row of rows) {
        if (row.schoolId !== actor.schoolId)
          continue
        if (actor.kind === 'guardian' && row.guardianId === actor.guardianId && await this.family(actor.guardianId, row.studentId, facts))
          ids.push(row.id)
        if (actor.kind === 'teacher' && row.teacherId === actor.teacherId && await this.teaching(row, facts))
          ids.push(row.id)
      }
    }
    return { schoolId: actor.schoolId, ids, profileKind: actor.kind, profileId: actor.actorId }
  }

  async assertStart(input: { destination: 'school' | 'teacher', studentId?: string, teacherId?: string }) {
    const actor = this.access.actor
    const facts = this.facts()
    await facts.validateActor()
    if (actor.kind !== 'guardian' || !await this.family(actor.guardianId, input.studentId))
      denied()
    if (input.destination === 'teacher') {
      const teachers = await this.eligibleTeachers(input.studentId!)
      const teacher = teachers.find(row => row.id === input.teacherId)
      if (!teacher)
        denied('Teacher is not currently available for this child')
      return teacher.assignmentIds
    }
    return []
  }

  async eligibleTeachers(studentId: string) {
    const actor = this.access.actor
    const facts = this.facts()
    await facts.validateActor()
    if (actor.kind !== 'guardian' || !await this.family(actor.guardianId, studentId))
      denied()
    const year = await facts.academicYear()
    const enrollments = await facts.list('enrollments', { studentId, status: StudentClassEnrollmentStatus.Active })
    const assignments = await facts.list('teacherAssignments', { status: TeacherAssignmentStatus.Active, ...(year ? { academicYearId: year } : {}) })
    const result = new Map<string, { id: string, name: string, subjects: string[], assignmentIds: string[] }>()
    for (const a of assignments) {
      if ((a.startsAt && a.startsAt > facts.now) || (a.endsAt && a.endsAt <= facts.now))
        continue
      const subject = a.classSubjectId ? await facts.repository('classSubjects').findById(a.classSubjectId) : undefined
      const classId = a.classGroupId ?? subject?.classGroupId
      if (!classId || !enrollments.some(e => e.classGroupId === classId && e.academicYearId === a.academicYearId))
        continue
      const teacher = await facts.repository('teachers').findById(a.teacherId)
      if (!teacher?.isActive || !teacher.subjectId)
        continue
      const label = subject ? (await facts.repository('subjects').findById(subject.subjectId))?.name : undefined
      const row = result.get(teacher.id) ?? { id: teacher.id, name: teacher.fullName, subjects: [], assignmentIds: [] }
      row.assignmentIds.push(a.id)
      if (label && !row.subjects.includes(label))
        row.subjects.push(label)
      result.set(row.id, row)
    }
    return [...result.values()].sort((a, b) => a.name.localeCompare(b.name))
  }
}
