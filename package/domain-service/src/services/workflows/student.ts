import type { Attachment, AttachmentInput, ClassGroup, GuardianInput, GuardianStudentLink as GuardianStudentLinkType, ManageStudentSubjectEnrollmentsInput, StudentHealthProfile, StudentHealthProfileInput, StudentInput, StudentNote, StudentNoteInput, StudentPhotoSubmission } from '@edaya/core'
import type {
  CreateProfilePhotoUploadInput,
} from '../../capabilities/files/profile-photo-uploads'
import type {
  PublishStudentPhotoInput,
  ReviewStudentPhotoInput,
  SubmitStudentPhotoInput,
  WithdrawStudentPhotoSubmissionInput,
} from '../../capabilities/files/student-photos'
import type { BaseSchoolService } from '../base-school-service'
import type { StudentWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { denyResourceAccess, resolveAuditActorId } from '@edaya/authorization'
import { AccountInvitationKind, AttachmentOwnerKind, BusinessRuleViolationError, EnrollmentEndReason, Guardian, GuardianStudentLink, ProgressionDecision, Student, StudentClassEnrollment, StudentClassEnrollmentStatus, StudentHealthProfile as StudentHealthProfileEntity, StudentNote as StudentNoteEntity, StudentStatus } from '@edaya/core'
import {
  completeProfilePhotoUpload,
  createProfilePhotoUpload,
  publishStudentPhoto,
  reviewStudentPhoto,
  submitStudentPhoto,
  withdrawStudentPhotoSubmission,
} from '../../capabilities/files'
import { assertImmediatePortraitPhotoUrl } from '../../capabilities/files/profile-photo-access'
import { resolveStudentInvitationEmail, scheduleAccountInvitationIfEligible } from '../../capabilities/invitations'
import { carrySubjectChoices, subjectTransferImpact } from '../../capabilities/subject-enrollment/transfer'
import { pickWorkflowRepositories } from '../runtime/workflow-repository-catalog'
import { BaseServiceWorkflow } from './base-service-workflow'
import { manageSubjectEnrollments } from './subject-enrollment'

export interface EnrollStudentInput {
  enrolledAt?: Date
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
  acknowledgedDroppedSubjectIds?: string[]
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

export type RegisterStudentInput = Omit<StudentInput, 'id'> & {
  id?: string
  sendAccountInvitation?: boolean
  inviteEmail?: string
}
export type RegisterGuardianInput = Omit<GuardianInput, 'id'> & {
  id?: string
  sendAccountInvitation?: boolean
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

export interface UpdateStudentProfileInput extends Partial<Omit<StudentInput, 'photoUrl' | 'photoAttachmentId'>> {
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

export interface UpdateGuardianProfileInput extends Partial<Omit<GuardianInput, 'id' | 'schoolId' | 'subjectId' | 'createdAt'>> {
  studentNotificationPreferences?: Array<{ studentId: string, receivesAcademicReports?: boolean, receivesAttendanceAlerts?: boolean }>
  guardianId: string
}

export interface UpdateGuardianStudentLinkInput extends Partial<ConstructorParameters<typeof GuardianStudentLink>[0]> {
  guardianId: string
  studentId: string
}

export type {
  CreateProfilePhotoUploadInput,
} from '../../capabilities/files/profile-photo-uploads'
export type {
  PublishStudentPhotoInput,
  ReviewStudentPhotoInput,
  SubmitStudentPhotoInput,
  WithdrawStudentPhotoSubmissionInput,
} from '../../capabilities/files/student-photos'

export class StudentServiceWorkflow extends BaseServiceWorkflow {
  manageStudentSubjectEnrollments(input: ManageStudentSubjectEnrollmentsInput) { return manageSubjectEnrollments(this.baseService, input) }
  private readonly repositories: StudentWorkflowRepositories

  constructor(base: BaseSchoolService) {
    super(base)
    this.repositories = pickWorkflowRepositories('student', base.repositories)
  }

  async registerStudent(input: RegisterStudentInput): Promise<Student> {
    return this.baseService.atomicExecution.execute(async () => {
      const { sendAccountInvitation, inviteEmail, ...entityInput } = input
      const autoInviteEnabled = sendAccountInvitation !== false
        && this.baseService.accountInvitationsEnabled !== false
        && Boolean(this.baseService.inviteBaseUrl)
      if (autoInviteEnabled && !resolveStudentInvitationEmail(inviteEmail)) {
        throw new BusinessRuleViolationError(
          'INVITATION_CONTACT_REQUIRED',
          'inviteEmail is required when auto-invite is enabled for student registration',
        )
      }

      const id = await this.allocateNewEntityId(
        candidate => this.baseService.repositories.students.findById(candidate),
        entityInput.id,
        'STUDENT_ID_ALREADY_EXISTS',
        'Student',
      )
      const student = new Student({ ...entityInput, id })
      await this.baseService.entities.students.save(student)
      await scheduleAccountInvitationIfEligible(
        this.baseService,
        {
          kind: AccountInvitationKind.Student,
          targetId: student.id,
          sendAccountInvitation,
          inviteEmail,
        },
        student,
      )
      return student
    })
  }

  async registerGuardian(input: RegisterGuardianInput): Promise<Guardian> {
    return this.baseService.atomicExecution.execute(async () => {
      const { sendAccountInvitation, ...entityInput } = input
      const id = await this.allocateNewEntityId(
        candidate => this.baseService.repositories.guardians.findById(candidate),
        entityInput.id,
        'GUARDIAN_ID_ALREADY_EXISTS',
        'Guardian',
      )
      const guardian = new Guardian({ ...entityInput, id })
      await this.baseService.entities.guardians.save(guardian)
      await scheduleAccountInvitationIfEligible(
        this.baseService,
        {
          kind: AccountInvitationKind.Guardian,
          targetId: guardian.id,
          sendAccountInvitation,
        },
        guardian,
      )
      return guardian
    })
  }

  async enrollStudent({
    id,
    studentId,
    classGroupId,
    createdAt,
    enrolledAt,
  }: EnrollStudentInput): Promise<StudentClassEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
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

      await this.baseService.access.enrollments.assertCreate({ studentId: student.id, classGroupId: classGroup.id })

      const existingEnrollments = await this.repositories.enrollments.list({ studentId })
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
        enrolledAt,
        createdAt,
      })
      await this.baseService.entities.enrollments.save(enrollment)
      return enrollment
    }, { lockKeys: [`academic-state:${this.baseService.actor.schoolId}`] })
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
    return this.baseService.atomicExecution.execute(async () => {
      const { guardian, student } = await this.baseService.access.guardians.assertLinkStudent({ guardianId, studentId })
      if (guardian.schoolId !== student.schoolId) {
        denyResourceAccess()
      }
      this.checkActorSchool(guardian.schoolId)

      const existing = await this.repositories.guardianLinks.findOne({ guardianId, studentId })
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
      await this.baseService.entities.guardianLinks.save(link)
      return link
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
    return this.baseService.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const sourceClassGroup = await this.requireClassGroup(enrollment.classGroupId)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const [sourceGradeLevel, nextGradeLevel] = await Promise.all([
        this.repositories.gradeLevels.findById(sourceClassGroup.gradeLevelId),
        this.repositories.gradeLevels.findById(nextClassGroup.gradeLevelId),
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
      await this.baseService.entities.enrollments.save(completed)
      await this.baseService.entities.enrollments.save(successor)
      return successor
    }, { lockKeys: [`academic-state:${this.baseService.actor.schoolId}`] })
  }

  async transferStudent({
    enrollmentId,
    nextEnrollmentId,
    nextClassGroupId,
    effectiveAt,
    acknowledgedDroppedSubjectIds = [],
  }: TransferStudentInput): Promise<StudentClassEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
      const enrollment = await this.requireManagedEnrollment(enrollmentId)
      await this.requireCurrentActiveEnrollment(enrollment)
      const nextClassGroup = await this.requireTransitionTarget(enrollment, nextClassGroupId)
      const impact = await subjectTransferImpact(this.baseService.repositories, enrollment, nextClassGroupId, effectiveAt)
      const unsupported = impact.filter(choice => !choice.destinationClassSubjectId)
      if (unsupported.some(choice => !acknowledgedDroppedSubjectIds.includes(choice.subjectId)))
        throw new BusinessRuleViolationError('TRANSFER_OPTIONAL_CHOICES_ACKNOWLEDGMENT_REQUIRED', 'Confirm the optional subjects unavailable in the destination class', { unsupportedChoices: unsupported.map(choice => ({ subjectId: choice.subjectId, subjectName: choice.subjectName, enrollmentId: choice.enrollment.id })) })
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
      await this.baseService.entities.enrollments.save(transferred)
      await this.baseService.entities.enrollments.save(successor)
      await carrySubjectChoices(this.baseService.repositories, impact, successor, this.baseService.actor)
      return successor
    }, { lockKeys: [`academic-state:${this.baseService.actor.schoolId}`] })
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
        ...student.data,
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
      await this.baseService.entities.enrollments.save(graduatedEnrollment)
      await this.baseService.entities.students.save(graduatedStudent)
      return graduatedEnrollment
    }, { lockKeys: [`academic-state:${this.baseService.actor.schoolId}`] })
  }

  async closeEnrollment({ enrollmentId, endReason, endedAt }: CloseEnrollmentInput): Promise<StudentClassEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireManagedEnrollment(enrollmentId)
      const closed = existing.close({
        endedAt: endedAt ?? new Date(),
        endReason,
        closedBy: resolveAuditActorId(this.baseService.actor),
      })
      await this.baseService.entities.enrollments.save(closed)
      return closed
    }, { lockKeys: [`academic-state:${this.baseService.actor.schoolId}`] })
  }

  async recordProgressionDecision({
    enrollmentId,
    decision,
    decidedAt,
    notes,
  }: RecordProgressionDecisionInput): Promise<StudentClassEnrollment> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireManagedEnrollment(enrollmentId)
      const decided = existing.recordProgressionDecision({
        decision,
        decidedAt: decidedAt ?? new Date(),
        decidedBy: resolveAuditActorId(this.baseService.actor),
        notes,
      })
      await this.baseService.entities.enrollments.save(decided)
      return decided
    })
  }

  async updateStudentProfile({ studentId, ...changes }: UpdateStudentProfileInput): Promise<Student> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.students, studentId)
      const { photoUrl: _photoUrl, photoAttachmentId: _photoAttachmentId, ...profile } = changes as Partial<StudentInput>
      const student = existing.copyWith(profile)
      await this.baseService.entities.students.save(student)
      return student
    })
  }

  async updateStudentStatus({ studentId, status }: UpdateStudentStatusInput): Promise<Student> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.students, studentId)
      const student = existing.copyWith({ status })
      await this.baseService.entities.students.save(student)
      return student
    })
  }

  async upsertStudentHealthProfile(input: UpsertStudentHealthProfileInput): Promise<StudentHealthProfile> {
    return this.baseService.atomicExecution.execute(async () => {
      const student = await this.requireEntity(this.baseService.entities.students, input.studentId)
      const healthProfile = new StudentHealthProfileEntity({
        ...input,
        schoolId: input.schoolId ?? student.schoolId,
      })
      await this.baseService.entities.studentHealthProfiles.save(healthProfile)
      return healthProfile
    })
  }

  async createStudentNote(input: CreateStudentNoteInput): Promise<StudentNote> {
    return this.baseService.atomicExecution.execute(async () => {
      const student = await this.requireEntity(this.baseService.entities.students, input.studentId)
      const note = new StudentNoteEntity({
        ...input,
        schoolId: input.schoolId ?? student.schoolId,
        authorStaffId: input.authorStaffId ?? resolveAuditActorId(this.baseService.actor),
      })
      await this.baseService.entities.studentNotes.save(note)
      return note
    })
  }

  async updateStudentNote({ noteId, ...changes }: UpdateStudentNoteInput): Promise<StudentNote> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.studentNotes, noteId)
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
      await this.baseService.entities.studentNotes.save(note)
      return note
    })
  }

  async updateGuardianProfile({ guardianId, studentNotificationPreferences, ...changes }: UpdateGuardianProfileInput): Promise<Guardian> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireEntity(this.baseService.entities.guardians, guardianId)
      await assertImmediatePortraitPhotoUrl(this.baseService, AttachmentOwnerKind.Guardian, guardianId, changes.photoUrl)
      const guardian = new Guardian({
        ...existing.data,
        ...Object.fromEntries(Object.entries(changes).filter(([, value]) => value !== undefined)),
        code: Object.hasOwn(changes, 'code') ? changes.code : existing.code,
        occupation: Object.hasOwn(changes, 'occupation') ? changes.occupation : existing.occupation,
        sourceFullName: Object.hasOwn(changes, 'sourceFullName') ? changes.sourceFullName : existing.sourceFullName,
        photoUrl: Object.hasOwn(changes, 'photoUrl') ? changes.photoUrl : existing.photoUrl,
        id: existing.id,
        schoolId: existing.schoolId,
        subjectId: existing.subjectId,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.guardians.save(guardian)
      const seen = new Set<string>()
      for (const preference of studentNotificationPreferences ?? []) {
        if (seen.has(preference.studentId))
          throw new BusinessRuleViolationError('DUPLICATE_GUARDIAN_STUDENT_PREFERENCE', 'Each student must appear once')
        seen.add(preference.studentId)
        await this.updateGuardianStudentLink({ guardianId, studentId: preference.studentId, receivesAcademicReports: preference.receivesAcademicReports, receivesAttendanceAlerts: preference.receivesAttendanceAlerts })
      }

      return guardian
    })
  }

  async updateGuardianStudentLink({
    guardianId,
    studentId,
    ...changes
  }: UpdateGuardianStudentLinkInput): Promise<GuardianStudentLinkType> {
    return this.baseService.atomicExecution.execute(async () => {
      const existing = await this.requireOne(this.baseService.entities.guardianLinks, { guardianId, studentId })
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
        emergencyContactPriority: Object.hasOwn(changes, 'emergencyContactPriority') ? changes.emergencyContactPriority : existing.emergencyContactPriority,
        receivesAcademicReports: changes.receivesAcademicReports ?? existing.receivesAcademicReports,
        receivesAttendanceAlerts: changes.receivesAttendanceAlerts ?? existing.receivesAttendanceAlerts,
        contactRestrictions: Object.hasOwn(changes, 'contactRestrictions') ? changes.contactRestrictions : existing.contactRestrictions,
        notes: Object.hasOwn(changes, 'notes') ? changes.notes : existing.notes,
        createdAt: existing.createdAt,
      })
      await this.baseService.entities.guardianLinks.save(link)

      return link
    })
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
    this.checkActorSchool(classGroup.schoolId)

    await this.baseService.access.enrollments.assertUpdate({ studentId: student.id, classGroupId: classGroup.id })
    return enrollment
  }

  private async requireCurrentActiveEnrollment(enrollment: StudentClassEnrollment): Promise<void> {
    const activeEnrollment = await this.repositories.enrollments.findOne({
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
    await this.baseService.access.enrollments.assertUpdate({ studentId: enrollment.studentId, classGroupId: nextClassGroup.id })
    return nextClassGroup
  }

  async createProfilePhotoUpload(input: CreateProfilePhotoUploadInput) {
    return createProfilePhotoUpload(this.baseService, input)
  }

  async completeProfilePhotoUpload(input: AttachmentInput): Promise<Attachment> {
    return completeProfilePhotoUpload(this.baseService, input)
  }

  async submitStudentPhoto(input: SubmitStudentPhotoInput): Promise<StudentPhotoSubmission> {
    return submitStudentPhoto(this.baseService, input)
  }

  async withdrawStudentPhotoSubmission(input: WithdrawStudentPhotoSubmissionInput): Promise<StudentPhotoSubmission> {
    return withdrawStudentPhotoSubmission(this.baseService, input)
  }

  async reviewStudentPhoto(input: ReviewStudentPhotoInput): Promise<StudentPhotoSubmission> {
    return reviewStudentPhoto(this.baseService, input)
  }

  async publishStudentPhoto(input: PublishStudentPhotoInput): Promise<Student> {
    return publishStudentPhoto(this.baseService, input)
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
    const activeEnrollments = await this.repositories.enrollments.list({
      classGroupId: classGroup.id,
      status: StudentClassEnrollmentStatus.Active,
    })
    if (activeEnrollments.length >= classGroup.capacity) {
      throw new BusinessRuleViolationError('CLASS_GROUP_CAPACITY_EXCEEDED', `Class group ${classGroup.id} has reached capacity`)
    }
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
