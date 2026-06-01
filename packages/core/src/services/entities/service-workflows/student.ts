import type { ClassGroup } from '../../../entities'
import type { BaseSchoolService } from '../base-school-service'
import { Student, StudentStatus } from '../../../entities/students/student'
import { EnrollmentEndReason, ProgressionDecision, StudentClassEnrollment, StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { resolveAuditActorId } from '../../authorization'
import { denyResourceAccess } from '../../authorization/authorization-error'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface PromoteStudentInput {
  enrollmentId: string
  nextEnrollmentId: string
  nextClassGroupId: string
  effectiveAt: Date
  decidedAt?: Date
  notes?: string
}

export interface TransferStudentInput {
  enrollmentId: string
  nextEnrollmentId: string
  nextClassGroupId: string
  effectiveAt: Date
}

export interface CloseEnrollmentInput {
  enrollmentId: string
  endReason: EnrollmentEndReason
  endedAt?: Date
}

export interface RecordProgressionDecisionInput {
  enrollmentId: string
  decision: ProgressionDecision
  decidedAt?: Date
  notes?: string
}

export interface GraduateStudentInput {
  enrollmentId: string
  effectiveAt: Date
  decidedAt?: Date
  notes?: string
}

export class StudentServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async closeEnrollment({
    enrollmentId,
    endReason,
    endedAt = new Date(),
  }: CloseEnrollmentInput): Promise<StudentClassEnrollment> {
    return this.base.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const closed = enrollment.close({
        endedAt,
        endReason,
        closedBy: resolveAuditActorId(this.base.actor),
      })
      await this.base.enrollments.save(closed, { moduleChecked: true })
      return closed
    })
  }

  async recordProgressionDecision({
    enrollmentId,
    decision,
    decidedAt = new Date(),
    notes,
  }: RecordProgressionDecisionInput): Promise<StudentClassEnrollment> {
    return this.base.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      const decided = enrollment.recordProgressionDecision({
        decision,
        decidedAt,
        decidedBy: resolveAuditActorId(this.base.actor),
        notes,
      })
      await this.base.enrollments.save(decided, { moduleChecked: true })
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
  }: PromoteStudentInput): Promise<StudentClassEnrollment> {
    return this.base.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const sourceClassGroup = await this.requireClassGroup(enrollment.classGroupId)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const [sourceGradeLevel, nextGradeLevel] = await Promise.all([
        this.base.repositories.gradeLevels.findById(sourceClassGroup.gradeLevelId),
        this.base.repositories.gradeLevels.findById(nextClassGroup.gradeLevelId),
      ])
      if (!sourceGradeLevel || !nextGradeLevel || nextGradeLevel.order <= sourceGradeLevel.order) {
        throw new BusinessRuleViolationError('INVALID_PROMOTION_TARGET', 'Promotion target must belong to a higher grade level')
      }

      const completed = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Completed,
        closedBy: resolveAuditActorId(this.base.actor),
      }).recordProgressionDecision({
        decision: ProgressionDecision.Promoted,
        decidedAt,
        decidedBy: resolveAuditActorId(this.base.actor),
        notes,
      })
      const successor = await this.createSuccessorEnrollment({
        id: nextEnrollmentId,
        previousEnrollment: enrollment,
        classGroup: nextClassGroup,
        enrolledAt: effectiveAt,
      })
      await this.base.enrollments.save(completed, { moduleChecked: true })
      await this.base.enrollments.save(successor, { moduleChecked: true })
      return successor
    })
  }

  async transferStudent({
    enrollmentId,
    nextEnrollmentId,
    nextClassGroupId,
    effectiveAt,
  }: TransferStudentInput): Promise<StudentClassEnrollment> {
    return this.base.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const transferred = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Transferred,
        closedBy: resolveAuditActorId(this.base.actor),
      })
      const successor = await this.createSuccessorEnrollment({
        id: nextEnrollmentId,
        previousEnrollment: enrollment,
        classGroup: nextClassGroup,
        enrolledAt: effectiveAt,
      })
      await this.base.enrollments.save(transferred, { moduleChecked: true })
      await this.base.enrollments.save(successor, { moduleChecked: true })
      return successor
    })
  }

  async graduateStudent({
    enrollmentId,
    effectiveAt,
    decidedAt = effectiveAt,
    notes,
  }: GraduateStudentInput): Promise<StudentClassEnrollment> {
    return this.base.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const student = await this.requireStudent(enrollment.studentId)
      const graduatedEnrollment = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Completed,
        closedBy: resolveAuditActorId(this.base.actor),
      }).recordProgressionDecision({
        decision: ProgressionDecision.Graduated,
        decidedAt,
        decidedBy: resolveAuditActorId(this.base.actor),
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
        subjectId: student.subjectId,
        status: StudentStatus.Graduated,
        enrollmentDate: student.enrollmentDate,
        createdAt: student.createdAt,
      })
      await this.base.enrollments.save(graduatedEnrollment, { moduleChecked: true })
      await this.base.students.save(graduatedStudent, { moduleChecked: true })
      return graduatedEnrollment
    })
  }

  private async requireManagedEnrollment(enrollmentId: string): Promise<StudentClassEnrollment> {
    const enrollment = await this.base.repositories.enrollments.findById(enrollmentId)
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
    this.checkActorSchool(classGroup.schoolId)
    await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'students.manage_enrollment')
    await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [student.id])
    await this.base.authorizationPolicy.checkClassGroupAccess(this.base.actor, [classGroup.id])
    return enrollment
  }

  private async requireCurrentActiveEnrollment(enrollment: StudentClassEnrollment): Promise<void> {
    const activeEnrollment = await this.base.repositories.enrollments.findOne({
      studentId: enrollment.studentId,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (enrollment.status !== StudentClassEnrollmentStatus.Active || activeEnrollment?.id !== enrollment.id) {
      throw new BusinessRuleViolationError('ENROLLMENT_NOT_ACTIVE', `Enrollment ${enrollment.id} is not the student's active enrollment`)
    }
  }

  private async requireTransitionTarget(
    enrollment: StudentClassEnrollment,
    nextClassGroupId: string,
  ): Promise<ClassGroup> {
    const sourceClassGroup = await this.requireClassGroup(enrollment.classGroupId)
    const nextClassGroup = await this.requireClassGroup(nextClassGroupId)
    if (nextClassGroup.id === sourceClassGroup.id) {
      throw new BusinessRuleViolationError('SUCCESSOR_ENROLLMENT_SAME_CLASS_GROUP', 'A successor enrollment must target a different class group')
    }
    if (nextClassGroup.schoolId !== sourceClassGroup.schoolId) {
      denyResourceAccess()
    }
    await this.base.authorizationPolicy.checkClassGroupAccess(this.base.actor, [nextClassGroup.id])
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
      this.base.repositories.enrollments.findById(id),
      this.base.repositories.enrollments.list({ studentId: previousEnrollment.studentId }),
    ])
    if (existingEnrollment) {
      throw new BusinessRuleViolationError('ENROLLMENT_ID_ALREADY_EXISTS', `Enrollment id ${id} already exists`)
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
    const activeEnrollments = await this.base.repositories.enrollments.list({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (activeEnrollments.length >= classGroup.capacity) {
      throw new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_EXCEEDED', `Class group ${classGroup.id} has reached capacity`)
    }
  }
}
