import type { ClassGroup } from '../../entities/school/class-group'
import type { School } from '../../entities/school/school'
import type { GuardianContactMethod } from '../../entities/students/guardian-contact-method'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata, AuthorizationPolicy } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { Guardian } from '../../entities/students/guardian'
import { GuardianStudentLink } from '../../entities/students/guardian-student-link'
import { Student, StudentStatus } from '../../entities/students/student'
import {
  EnrollmentEndReason,
  ProgressionDecision,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
} from '../../entities/students/student-class-enrollment'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'

export class StudentsService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.atomicExecution = args.atomicExecution
    this.repositories = args.repositories
  }

  private readonly actor: ActorMetadata
  private readonly authorizationPolicy: AuthorizationPolicy
  private readonly atomicExecution: AtomicExecutionPort
  private readonly repositories: SchoolRepositories

  async registerStudent({
    id,
    schoolId,
    firstName,
    lastName,
    birthDate,
    createdAt,
  }: {
    id: string
    schoolId: string
    firstName: string
    lastName: string
    birthDate?: Date
    createdAt?: Date
  }): Promise<Student> {
    await this.authorize('students.manage_enrollment', { schoolId })
    await this.requireSchool(schoolId)
    const student = new Student({ id, schoolId, firstName, lastName, birthDate, createdAt })
    await this.repositories.students.save(student)
    return student
  }

  async enrollStudent({
    id,
    studentId,
    classGroupId,
    createdAt,
  }: {
    id: string
    studentId: string
    classGroupId: string
    createdAt?: Date
  }): Promise<StudentClassEnrollment> {
    const student = await this.requireStudent(studentId)
    const classGroup = await this.requireClassGroup(classGroupId)
    if (student.status !== StudentStatus.Active) {
      throw new Error(`Student ${studentId} is not active and cannot be enrolled`)
    }
    if (student.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('students.manage_enrollment', {
      schoolId: classGroup.schoolId,
      classGroupId,
      studentId: student.id,
    })

    const existingEnrollments = await this.repositories.enrollments.list({ studentId })
    const activeEnrollment = existingEnrollments.find(
      enrollment => enrollment.status === StudentClassEnrollmentStatus.Active,
    )
    if (activeEnrollment && activeEnrollment.classGroupId !== classGroupId) {
      throw new Error(`Student ${studentId} already has an active class enrollment`)
    }
    if (activeEnrollment) {
      return activeEnrollment
    }
    await this.requireAvailableCapacity(classGroup)
    const nextEnrollmentIndex = Math.max(0, ...existingEnrollments.map(enrollment => enrollment.enrollmentIndex)) + 1

    const enrollment = new StudentClassEnrollment({
      id,
      studentId,
      classGroupId,
      academicYearId: classGroup.academicYearId,
      enrollmentIndex: nextEnrollmentIndex,
      createdAt,
    })
    await this.repositories.enrollments.save(enrollment)
    return enrollment
  }

  async closeEnrollment({
    enrollmentId,
    endReason,
    endedAt = new Date(),
  }: {
    enrollmentId: string
    endReason: EnrollmentEndReason
    endedAt?: Date
  }): Promise<StudentClassEnrollment> {
    return this.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const closed = enrollment.close({
        endedAt,
        endReason,
        closedBy: resolveAuditActorId(this.actor),
      })
      await this.repositories.enrollments.save(closed)
      return closed
    })
  }

  async recordProgressionDecision({
    enrollmentId,
    decision,
    decidedAt = new Date(),
    notes,
  }: {
    enrollmentId: string
    decision: ProgressionDecision
    decidedAt?: Date
    notes?: string
  }): Promise<StudentClassEnrollment> {
    return this.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      const decided = enrollment.recordProgressionDecision({
        decision,
        decidedAt,
        decidedBy: resolveAuditActorId(this.actor),
        notes,
      })
      await this.repositories.enrollments.save(decided)
      return decided
    })
  }

  async promoteStudent({
    enrollmentId,
    nextEnrollmentId,
    nextClassGroupId,
    effectiveAt,
    decidedAt = effectiveAt,
    notes,
  }: {
    enrollmentId: string
    nextEnrollmentId: string
    nextClassGroupId: string
    effectiveAt: Date
    decidedAt?: Date
    notes?: string
  }): Promise<StudentClassEnrollment> {
    return this.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const sourceClassGroup = await this.requireClassGroup(enrollment.classGroupId)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const [sourceGradeLevel, nextGradeLevel] = await Promise.all([
        this.repositories.gradeLevels.findById(sourceClassGroup.gradeLevelId),
        this.repositories.gradeLevels.findById(nextClassGroup.gradeLevelId),
      ])
      if (!sourceGradeLevel || !nextGradeLevel || nextGradeLevel.order <= sourceGradeLevel.order) {
        throw new Error('Promotion target must belong to a higher grade level')
      }
      const completed = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Completed,
        closedBy: resolveAuditActorId(this.actor),
      }).recordProgressionDecision({
        decision: ProgressionDecision.Promoted,
        decidedAt,
        decidedBy: resolveAuditActorId(this.actor),
        notes,
      })
      const successor = await this.createSuccessorEnrollment({
        id: nextEnrollmentId,
        previousEnrollment: enrollment,
        classGroup: nextClassGroup,
        enrolledAt: effectiveAt,
      })
      await this.repositories.enrollments.save(completed)
      await this.repositories.enrollments.save(successor)
      return successor
    })
  }

  async transferStudent({
    enrollmentId,
    nextEnrollmentId,
    nextClassGroupId,
    effectiveAt,
  }: {
    enrollmentId: string
    nextEnrollmentId: string
    nextClassGroupId: string
    effectiveAt: Date
  }): Promise<StudentClassEnrollment> {
    return this.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const transferred = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Transferred,
        closedBy: resolveAuditActorId(this.actor),
      })
      const successor = await this.createSuccessorEnrollment({
        id: nextEnrollmentId,
        previousEnrollment: enrollment,
        classGroup: nextClassGroup,
        enrolledAt: effectiveAt,
      })
      await this.repositories.enrollments.save(transferred)
      await this.repositories.enrollments.save(successor)
      return successor
    })
  }

  async graduateStudent({
    enrollmentId,
    effectiveAt,
    decidedAt = effectiveAt,
    notes,
  }: {
    enrollmentId: string
    effectiveAt: Date
    decidedAt?: Date
    notes?: string
  }): Promise<StudentClassEnrollment> {
    return this.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const student = await this.requireStudent(enrollment.studentId)
      const graduatedEnrollment = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Completed,
        closedBy: resolveAuditActorId(this.actor),
      }).recordProgressionDecision({
        decision: ProgressionDecision.Graduated,
        decidedAt,
        decidedBy: resolveAuditActorId(this.actor),
        notes,
      })
      const graduatedStudent = new Student({
        id: student.id,
        schoolId: student.schoolId,
        firstName: student.firstName,
        lastName: student.lastName,
        gender: student.gender,
        birthDate: student.birthDate,
        placeOfBirth: student.placeOfBirth,
        nationality: student.nationality,
        matricule: student.matricule,
        photoUrl: student.photoUrl,
        status: StudentStatus.Graduated,
        enrollmentDate: student.enrollmentDate,
        createdAt: student.createdAt,
      })
      await this.repositories.enrollments.save(graduatedEnrollment)
      await this.repositories.students.save(graduatedStudent)
      return graduatedEnrollment
    })
  }

  async registerGuardian({
    id,
    schoolId,
    firstName,
    lastName,
    phone,
    email,
    contactMethods,
    hasAccess = true,
    premiumNotificationsEnabled = false,
    createdAt,
  }: {
    id: string
    schoolId: string
    firstName: string
    lastName: string
    phone?: string
    email?: string
    contactMethods?: readonly GuardianContactMethod[]
    hasAccess?: boolean
    premiumNotificationsEnabled?: boolean
    createdAt?: Date
  }): Promise<Guardian> {
    await this.authorize('students.manage_guardians', { schoolId })
    await this.requireSchool(schoolId)
    const guardian = new Guardian({
      id,
      schoolId,
      firstName,
      lastName,
      phone,
      email,
      contactMethods,
      hasAccess,
      premiumNotificationsEnabled,
      createdAt,
    })
    await this.repositories.guardians.save(guardian)
    return guardian
  }

  async linkGuardianToStudent({
    id,
    guardianId,
    studentId,
    relationship = 'parent',
    isPrimary = false,
    createdAt,
  }: {
    id: string
    guardianId: string
    studentId: string
    relationship?: string
    isPrimary?: boolean
    createdAt?: Date
  }): Promise<GuardianStudentLink> {
    const guardian = await this.requireGuardian(guardianId)
    const student = await this.requireStudent(studentId)
    if (guardian.schoolId !== student.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('students.manage_guardians', {
      schoolId: guardian.schoolId,
      guardianId,
      studentId: student.id,
    })

    const enrollments = await this.repositories.enrollments.list({ studentId })
    const isEnrolledInSchool = await Promise.all(
      enrollments.map(async (enrollment) => {
        const classGroup = await this.repositories.classGroups.findById(enrollment.classGroupId)
        return classGroup?.schoolId === guardian.schoolId
      }),
    ).then(results => results.some(result => result))

    if (!isEnrolledInSchool) {
      denyResourceAccess()
    }

    const existing = await this.repositories.guardianLinks.findByGuardianAndStudent(guardianId, studentId)
    const link = new GuardianStudentLink({
      id: existing?.id ?? id,
      schoolId: guardian.schoolId,
      guardianId,
      studentId,
      relationship,
      isPrimary,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.repositories.guardianLinks.save(link)
    return link
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.repositories.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async requireStudent(studentId: string): Promise<Student> {
    const student = await this.repositories.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  private async requireGuardian(guardianId: string): Promise<Guardian> {
    const guardian = await this.repositories.guardians.findById(guardianId)
    if (!guardian) {
      denyResourceAccess()
    }
    return guardian
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.repositories.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async requireManagedEnrollment(enrollmentId: string): Promise<StudentClassEnrollment> {
    const enrollment = await this.repositories.enrollments.findById(enrollmentId)
    if (!enrollment) {
      denyResourceAccess()
    }
    const [student, classGroup] = await Promise.all([
      this.requireStudent(enrollment.studentId),
      this.requireClassGroup(enrollment.classGroupId),
    ])
    if (student.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('students.manage_enrollment', {
      schoolId: classGroup.schoolId,
      classGroupId: classGroup.id,
      studentId: student.id,
    })
    return enrollment
  }

  private async requireCurrentActiveEnrollment(enrollment: StudentClassEnrollment): Promise<void> {
    const activeEnrollment = await this.repositories.enrollments.findActiveByStudent(enrollment.studentId)
    if (enrollment.status !== StudentClassEnrollmentStatus.Active || activeEnrollment?.id !== enrollment.id) {
      throw new Error(`Enrollment ${enrollment.id} is not the student's active enrollment`)
    }
  }

  private async requireTransitionTarget(
    enrollment: StudentClassEnrollment,
    nextClassGroupId: string,
  ): Promise<ClassGroup> {
    const sourceClassGroup = await this.requireClassGroup(enrollment.classGroupId)
    const nextClassGroup = await this.requireClassGroup(nextClassGroupId)
    if (nextClassGroup.id === sourceClassGroup.id) {
      throw new Error('A successor enrollment must target a different class group')
    }
    if (nextClassGroup.schoolId !== sourceClassGroup.schoolId) {
      denyResourceAccess()
    }
    return nextClassGroup
  }

  private async createSuccessorEnrollment({
    id,
    previousEnrollment,
    classGroup,
    enrolledAt,
  }: {
    id: string
    previousEnrollment: StudentClassEnrollment
    classGroup: ClassGroup
    enrolledAt: Date
  }): Promise<StudentClassEnrollment> {
    const [existingEnrollment, enrollments] = await Promise.all([
      this.repositories.enrollments.findById(id),
      this.repositories.enrollments.list({ studentId: previousEnrollment.studentId }),
    ])
    if (existingEnrollment) {
      throw new Error(`Enrollment id ${id} already exists`)
    }
    await this.requireAvailableCapacity(classGroup)
    const nextEnrollmentIndex = Math.max(0, ...enrollments.map(enrollment => enrollment.enrollmentIndex)) + 1
    return new StudentClassEnrollment({
      id,
      studentId: previousEnrollment.studentId,
      classGroupId: classGroup.id,
      academicYearId: classGroup.academicYearId,
      enrollmentIndex: nextEnrollmentIndex,
      enrolledAt,
      previousEnrollmentId: previousEnrollment.id,
    })
  }

  private async requireAvailableCapacity(classGroup: ClassGroup): Promise<void> {
    if (classGroup.capacity === undefined) {
      return
    }
    const activeEnrollments = await this.repositories.enrollments.list({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (activeEnrollments.length >= classGroup.capacity) {
      throw new Error(`Class group ${classGroup.id} has reached capacity`)
    }
  }

  private async authorize(
    action: 'students.manage_enrollment' | 'students.manage_guardians',
    resource: { schoolId: string, classGroupId?: string, studentId?: string, guardianId?: string },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}
