import type {
  ClassGroup,
  GuardianInput,
  GuardianStudentLink as GuardianStudentLinkType,
  StudentHealthProfile,
  StudentHealthProfileInput,
  StudentInput,
  StudentNote,
  StudentNoteInput,
} from '../../domains'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, Permission, resolveAuditActorId } from '../../authorization'
import {
  EnrollmentEndReason,
  Guardian,
  GuardianStudentLink,
  ProgressionDecision,
  Student,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
  StudentHealthProfile as StudentHealthProfileEntity,
  StudentNote as StudentNoteEntity,
  StudentStatus,
} from '../../domains'
import { permissionAction } from '../../shared'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface EnrollStudentInput {
  id: string
  studentId: string
  classGroupId: string
  createdAt?: Date
}

export interface LinkGuardianToStudentInput {
  id: string
  guardianId: string
  studentId: string
  relationship?: string
  isPrimary?: boolean
  isBillingContact?: boolean
  legalGuardian?: boolean
  canPickup?: boolean
  emergencyContactPriority?: number | null
  receivesAcademicReports?: boolean
  receivesAttendanceAlerts?: boolean
  contactRestrictions?: string | null
  notes?: string | null
  createdAt?: Date
}

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

export interface GraduateStudentInput {
  enrollmentId: string
  effectiveAt: Date
  decidedAt?: Date
  notes?: string
}

export type RegisterStudentInput = StudentInput
export type RegisterGuardianInput = GuardianInput

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

export interface UpdateStudentProfileInput extends Partial<StudentInput> {
  studentId: string
}

export interface UpdateStudentStatusInput {
  studentId: string
  status: StudentStatus
}

export type UpsertStudentHealthProfileInput = Omit<StudentHealthProfileInput, 'schoolId'> & {
  schoolId?: string
}

export type CreateStudentNoteInput = Omit<StudentNoteInput, 'schoolId' | 'authorStaffId'> & {
  schoolId?: string
  authorStaffId?: string
}

export interface UpdateStudentNoteInput extends Partial<StudentNoteInput> {
  noteId: string
}

export interface UpdateGuardianContactMethodsInput extends Partial<GuardianInput> {
  guardianId: string
}

export interface UpdateGuardianStudentLinkInput extends Partial<ConstructorParameters<typeof GuardianStudentLink>[0]> {
  guardianId: string
  studentId: string
}

export class StudentServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

  async registerStudent(input: RegisterStudentInput): Promise<Student> {
    const student = new Student(input)
    await this.baseService.students.save(student)
    return student
  }

  async registerGuardian(input: RegisterGuardianInput): Promise<Guardian> {
    const guardian = new Guardian(input)
    await this.baseService.guardians.save(guardian)
    return guardian
  }

  async enrollStudent({
    id,
    studentId,
    classGroupId,
    createdAt,
  }: EnrollStudentInput): Promise<StudentClassEnrollment> {
    const [student, classGroup] = await Promise.all([
      this.requireStudent(studentId),
      this.requireClassGroup(classGroupId),
    ])
    if (student.status !== StudentStatus.Active) {
      throw new BusinessRuleViolationError('STUDENT_NOT_ACTIVE', `Student ${studentId} is not active and cannot be enrolled`)
    }
    if (student.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    this.checkActorSchool(classGroup.schoolId)
    await permissionAction(Permission.ENROLLMENT_CREATE)(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
    await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [classGroup.id])

    const existingEnrollments = await this.baseService.repositories.enrollments.list({ studentId })
    const activeEnrollment = existingEnrollments.find(
      enrollment => enrollment.status === StudentClassEnrollmentStatus.Active,
    )
    if (activeEnrollment && activeEnrollment.classGroupId !== classGroupId) {
      throw new BusinessRuleViolationError('STUDENT_ALREADY_ENROLLED', `Student ${studentId} already has an active class enrollment`)
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
    await this.baseService.enrollments.save(enrollment, { moduleChecked: true })
    return enrollment
  }

  async linkGuardianToStudent({
    id,
    guardianId,
    studentId,
    relationship = 'parent',
    isPrimary = false,
    isBillingContact = false,
    legalGuardian = false,
    canPickup = false,
    emergencyContactPriority,
    receivesAcademicReports = true,
    receivesAttendanceAlerts = true,
    contactRestrictions,
    notes,
    createdAt,
  }: LinkGuardianToStudentInput): Promise<GuardianStudentLinkType> {
    const [guardian, student] = await Promise.all([
      this.requireGuardian(guardianId),
      this.requireStudent(studentId),
    ])
    if (guardian.schoolId !== student.schoolId) {
      denyResourceAccess()
    }
    this.checkActorSchool(guardian.schoolId)
    await permissionAction(Permission.PARENT_UPDATE)(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkGuardianAccess(this.baseService.actor, [guardian.id])
    await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])

    await this.requireStudentEnrolledInSchool(student.id, guardian.schoolId)

    const existing = await this.baseService.repositories.guardianLinks.findOne({ guardianId, studentId })
    const link = new GuardianStudentLink({
      id: existing?.id ?? id,
      schoolId: guardian.schoolId,
      guardianId,
      studentId,
      relationship,
      isPrimary,
      isBillingContact,
      legalGuardian,
      canPickup,
      emergencyContactPriority,
      receivesAcademicReports,
      receivesAttendanceAlerts,
      contactRestrictions,
      notes,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.baseService.guardianLinks.save(link, { moduleChecked: true })
    return link
  }

  async promoteStudent({
    enrollmentId,
    nextEnrollmentId,
    nextClassGroupId,
    effectiveAt,
    decidedAt = effectiveAt,
    notes,
  }: PromoteStudentInput): Promise<StudentClassEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const sourceClassGroup = await this.requireClassGroup(enrollment.classGroupId)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const [sourceGradeLevel, nextGradeLevel] = await Promise.all([
        this.baseService.repositories.gradeLevels.findById(sourceClassGroup.gradeLevelId),
        this.baseService.repositories.gradeLevels.findById(nextClassGroup.gradeLevelId),
      ])
      if (!sourceGradeLevel || !nextGradeLevel || nextGradeLevel.order <= sourceGradeLevel.order) {
        throw new BusinessRuleViolationError('INVALID_PROMOTION_TARGET', 'Promotion target must belong to a higher grade level')
      }

      const completed = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Completed,
        closedBy: resolveAuditActorId(this.baseService.actor),
      }).recordProgressionDecision({
        decision: ProgressionDecision.Promoted,
        decidedAt,
        decidedBy: resolveAuditActorId(this.baseService.actor),
        notes,
      })
      const successor = await this.createSuccessorEnrollment({
        id: nextEnrollmentId,
        previousEnrollment: enrollment,
        classGroup: nextClassGroup,
        enrolledAt: effectiveAt,
      })
      await this.baseService.enrollments.save(completed, { moduleChecked: true })
      await this.baseService.enrollments.save(successor, { moduleChecked: true })
      return successor
    })
  }

  async transferStudent({
    enrollmentId,
    nextEnrollmentId,
    nextClassGroupId,
    effectiveAt,
  }: TransferStudentInput): Promise<StudentClassEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const transferred = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Transferred,
        closedBy: resolveAuditActorId(this.baseService.actor),
      })
      const successor = await this.createSuccessorEnrollment({
        id: nextEnrollmentId,
        previousEnrollment: enrollment,
        classGroup: nextClassGroup,
        enrolledAt: effectiveAt,
      })
      await this.baseService.enrollments.save(transferred, { moduleChecked: true })
      await this.baseService.enrollments.save(successor, { moduleChecked: true })
      return successor
    })
  }

  async graduateStudent({
    enrollmentId,
    effectiveAt,
    decidedAt = effectiveAt,
    notes,
  }: GraduateStudentInput): Promise<StudentClassEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const student = await this.requireStudent(enrollment.studentId)
      const graduatedEnrollment = enrollment.close({
        endedAt: effectiveAt,
        endReason: EnrollmentEndReason.Completed,
        closedBy: resolveAuditActorId(this.baseService.actor),
      }).recordProgressionDecision({
        decision: ProgressionDecision.Graduated,
        decidedAt,
        decidedBy: resolveAuditActorId(this.baseService.actor),
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
      await this.baseService.enrollments.save(graduatedEnrollment, { moduleChecked: true })
      await this.baseService.students.save(graduatedStudent, { moduleChecked: true })
      return graduatedEnrollment
    })
  }

  async closeEnrollment({ enrollmentId, endReason, endedAt }: CloseEnrollmentInput): Promise<StudentClassEnrollment> {
    const existing = await this.requireManagedEnrollment(enrollmentId)
    const closed = existing.close({
      endedAt: endedAt ?? new Date(),
      endReason,
      closedBy: resolveAuditActorId(this.baseService.actor),
    })
    await this.baseService.enrollments.save(closed)
    return closed
  }

  async recordProgressionDecision({
    enrollmentId,
    decision,
    decidedAt,
    notes,
  }: RecordProgressionDecisionInput): Promise<StudentClassEnrollment> {
    const existing = await this.requireManagedEnrollment(enrollmentId)
    const decided = existing.recordProgressionDecision({
      decision,
      decidedAt: decidedAt ?? new Date(),
      decidedBy: resolveAuditActorId(this.baseService.actor),
      notes,
    })
    await this.baseService.enrollments.save(decided)
    return decided
  }

  async updateStudentProfile({ studentId, ...changes }: UpdateStudentProfileInput): Promise<Student> {
    const existing = await this.requireEntity(this.baseService.students, studentId)
    const student = existing.copyWith(changes)
    await this.baseService.students.save(student)
    return student
  }

  async updateStudentStatus({ studentId, status }: UpdateStudentStatusInput): Promise<Student> {
    const existing = await this.requireEntity(this.baseService.students, studentId)
    const student = existing.copyWith({ status })
    await this.baseService.students.save(student)
    return student
  }

  async upsertStudentHealthProfile(input: UpsertStudentHealthProfileInput): Promise<StudentHealthProfile> {
    const student = await this.requireEntity(this.baseService.students, input.studentId)
    const healthProfile = new StudentHealthProfileEntity({
      ...input,
      schoolId: input.schoolId ?? student.schoolId,
    })
    await this.baseService.studentHealthProfiles.save(healthProfile)
    return healthProfile
  }

  async createStudentNote(input: CreateStudentNoteInput): Promise<StudentNote> {
    const student = await this.requireEntity(this.baseService.students, input.studentId)
    const note = new StudentNoteEntity({
      ...input,
      schoolId: input.schoolId ?? student.schoolId,
      authorStaffId: input.authorStaffId ?? resolveAuditActorId(this.baseService.actor),
    })
    await this.baseService.studentNotes.save(note)
    return note
  }

  async updateStudentNote({ noteId, ...changes }: UpdateStudentNoteInput): Promise<StudentNote> {
    const existing = await this.requireEntity(this.baseService.studentNotes, noteId)
    const note = new StudentNoteEntity({
      id: existing.id,
      schoolId: existing.schoolId,
      studentId: existing.studentId,
      authorStaffId: existing.authorStaffId,
      title: changes.title === undefined ? existing.title : changes.title,
      body: changes.body ?? existing.body,
      visibility: changes.visibility ?? existing.visibility,
      createdAt: existing.createdAt,
      updatedAt: new Date(),
    })
    await this.baseService.studentNotes.save(note)
    return note
  }

  async updateGuardianContactMethods({ guardianId, ...changes }: UpdateGuardianContactMethodsInput): Promise<Guardian> {
    const existing = await this.requireEntity(this.baseService.guardians, guardianId)
    const guardian = new Guardian({
      id: existing.id,
      schoolId: existing.schoolId,
      firstName: changes.firstName ?? existing.firstName,
      lastName: changes.lastName ?? existing.lastName,
      contactMethods: [...(changes.contactMethods ?? existing.contactMethods)],
      subjectId: existing.subjectId,
      hasAccess: changes.hasAccess ?? existing.hasAccess,
      premiumNotificationsEnabled: changes.premiumNotificationsEnabled ?? existing.premiumNotificationsEnabled,
      createdAt: existing.createdAt,
    })
    await this.baseService.guardians.save(guardian)
    return guardian
  }

  async updateGuardianStudentLink({
    guardianId,
    studentId,
    ...changes
  }: UpdateGuardianStudentLinkInput): Promise<GuardianStudentLinkType> {
    const existing = await this.requireOne(this.baseService.guardianLinks, { guardianId, studentId })
    const link = new GuardianStudentLink({
      id: existing.id,
      schoolId: existing.schoolId,
      guardianId: existing.guardianId,
      studentId: existing.studentId,
      relationship: changes.relationship ?? existing.relationship,
      isPrimary: changes.isPrimary ?? existing.isPrimary,
      isBillingContact: changes.isBillingContact ?? existing.isBillingContact,
      legalGuardian: changes.legalGuardian ?? existing.legalGuardian,
      canPickup: changes.canPickup ?? existing.canPickup,
      emergencyContactPriority: changes.emergencyContactPriority ?? existing.emergencyContactPriority,
      receivesAcademicReports: changes.receivesAcademicReports ?? existing.receivesAcademicReports,
      receivesAttendanceAlerts: changes.receivesAttendanceAlerts ?? existing.receivesAttendanceAlerts,
      contactRestrictions: changes.contactRestrictions ?? existing.contactRestrictions,
      notes: changes.notes ?? existing.notes,
      createdAt: existing.createdAt,
    })
    await this.baseService.guardianLinks.save(link)
    return link
  }

  private async requireManagedEnrollment(enrollmentId: string): Promise<StudentClassEnrollment> {
    const enrollment = await this.baseService.repositories.enrollments.findById(enrollmentId)
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
    await permissionAction(Permission.ENROLLMENT_CREATE)(this.baseService.actor)
    await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [student.id])
    await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [classGroup.id])
    return enrollment
  }

  private async requireCurrentActiveEnrollment(enrollment: StudentClassEnrollment): Promise<void> {
    const activeEnrollment = await this.baseService.repositories.enrollments.findOne({
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
    await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [nextClassGroup.id])
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
      this.baseService.repositories.enrollments.findById(id),
      this.baseService.repositories.enrollments.list({ studentId: previousEnrollment.studentId }),
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
    const activeEnrollments = await this.baseService.repositories.enrollments.list({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (activeEnrollments.length >= classGroup.capacity) {
      throw new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_EXCEEDED', `Class group ${classGroup.id} has reached capacity`)
    }
  }

  private async requireGuardian(guardianId: string): Promise<Guardian> {
    const guardian = await this.baseService.repositories.guardians.findById(guardianId)
    if (!guardian || guardian.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return guardian
  }

  private async requireStudentEnrolledInSchool(studentId: string, schoolId: string): Promise<void> {
    const enrollments = await this.baseService.repositories.enrollments.list({ studentId })
    for (const enrollment of enrollments) {
      const classGroup = await this.baseService.repositories.classGroups.findById(enrollment.classGroupId)
      if (classGroup?.schoolId === schoolId) {
        await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [classGroup.id])
        return
      }
    }
    denyResourceAccess()
  }

  private async requireEntity<T>(
    managedService: { findById: (id: string) => Promise<T | undefined> },
    id: string,
  ): Promise<T> {
    const entity = await managedService.findById(id)
    if (!entity) {
      denyResourceAccess()
    }
    return entity
  }

  private async requireOne<T>(
    managedService: { findOne: (filter: Record<string, unknown>) => Promise<T | undefined> },
    filter: Record<string, unknown>,
  ): Promise<T> {
    const entity = await managedService.findOne(filter)
    if (!entity) {
      denyResourceAccess()
    }
    return entity
  }
}
