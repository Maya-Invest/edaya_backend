import type { ClassGroup } from '../../entities/school/class-group'
import type { GuardianContactMethod } from '../../entities/students/guardian-contact-method'
import type { StudentNoteVisibility } from '../../entities/students/student-note'
import type { AtomicExecutionPort } from '../../ports/atomic-execution'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { ActorMetadata, AuthorizationAction, AuthorizationPolicy } from '../authorization'
import type { ServiceArgs } from '../school-headless-app'
import { StaffRole } from '../../entities/school/staff-member'
import { Guardian } from '../../entities/students/guardian'
import { GuardianStudentLink } from '../../entities/students/guardian-student-link'
import { Student, StudentStatus } from '../../entities/students/student'
import {
  EnrollmentEndReason,
  ProgressionDecision,
  StudentClassEnrollment,
  StudentClassEnrollmentStatus,
} from '../../entities/students/student-class-enrollment'
import { StudentHealthProfile } from '../../entities/students/student-health-profile'
import { StudentNoteVisibility as NoteVisibility, StudentNote } from '../../entities/students/student-note'
import { denyResourceAccess, resolveAuditActorId } from '../authorization'
import { requireSchool } from '../shared/require-school'

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
    await requireSchool(this.repositories.schools, schoolId)
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
    await requireSchool(this.repositories.schools, schoolId)
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

  async updateStudentProfile({
    studentId,
    firstName,
    lastName,
    gender,
    birthDate,
    placeOfBirth,
    nationality,
    matricule,
    photoUrl,
    enrollmentDate,
  }: {
    studentId: string
    firstName?: string
    lastName?: string
    gender?: string | null
    birthDate?: Date
    placeOfBirth?: string | null
    nationality?: string | null
    matricule?: string | null
    photoUrl?: string | null
    enrollmentDate?: Date | null
  }): Promise<Student> {
    const { student, classGroupId } = await this.requireStudentManagementContext(studentId)
    await this.authorize('students.manage_profile', {
      schoolId: student.schoolId,
      classGroupId,
      studentId: student.id,
    })
    const updated = new Student({
      id: student.id,
      schoolId: student.schoolId,
      firstName: firstName ?? student.firstName,
      lastName: lastName ?? student.lastName,
      gender: gender === undefined ? student.gender : gender,
      birthDate: birthDate ?? student.birthDate,
      placeOfBirth: placeOfBirth === undefined ? student.placeOfBirth : placeOfBirth,
      nationality: nationality === undefined ? student.nationality : nationality,
      matricule: matricule === undefined ? student.matricule : matricule,
      photoUrl: photoUrl === undefined ? student.photoUrl : photoUrl,
      status: student.status,
      enrollmentDate: enrollmentDate === undefined ? student.enrollmentDate : enrollmentDate,
      createdAt: student.createdAt,
    })
    await this.repositories.students.save(updated)
    return updated
  }

  async updateStudentStatus({
    studentId,
    status,
  }: {
    studentId: string
    status: StudentStatus
  }): Promise<Student> {
    const { student, classGroupId } = await this.requireStudentManagementContext(studentId)
    await this.authorize('students.manage_profile', {
      schoolId: student.schoolId,
      classGroupId,
      studentId: student.id,
    })
    if (student.status === StudentStatus.Graduated && status !== StudentStatus.Graduated) {
      throw new Error(`Student ${studentId} cannot leave graduated status through profile update`)
    }
    const updated = new Student({
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
      status,
      enrollmentDate: student.enrollmentDate,
      createdAt: student.createdAt,
    })
    await this.repositories.students.save(updated)
    return updated
  }

  async upsertStudentHealthProfile({
    id,
    studentId,
    allergies,
    medicalConditions,
    emergencyProtocols,
    bloodType,
    updatedAt,
  }: {
    id: string
    studentId: string
    allergies?: string | null
    medicalConditions?: string | null
    emergencyProtocols?: string | null
    bloodType?: string | null
    updatedAt?: Date
  }): Promise<StudentHealthProfile> {
    const { student, classGroupId } = await this.requireStudentManagementContext(studentId)
    await this.authorize('students.manage_health', {
      schoolId: student.schoolId,
      classGroupId,
      studentId: student.id,
    })
    const existingById = await this.repositories.studentHealthProfiles.findById(id)
    if (existingById && (existingById.schoolId !== student.schoolId || existingById.studentId !== student.id)) {
      denyResourceAccess()
    }
    const existing = existingById ?? (await this.repositories.studentHealthProfiles.list({
      schoolId: student.schoolId,
      studentId: student.id,
    })).sort((left, right) =>
      right.updatedAt.getTime() - left.updatedAt.getTime()
      || left.id.localeCompare(right.id))[0]
    const profile = new StudentHealthProfile({
      id: existing?.id ?? id,
      schoolId: student.schoolId,
      studentId: student.id,
      allergies: allergies === undefined ? existing?.allergies : allergies,
      medicalConditions: medicalConditions === undefined ? existing?.medicalConditions : medicalConditions,
      emergencyProtocols: emergencyProtocols === undefined ? existing?.emergencyProtocols : emergencyProtocols,
      bloodType: bloodType === undefined ? existing?.bloodType : bloodType,
      createdAt: existing?.createdAt,
      updatedAt,
    })
    await this.repositories.studentHealthProfiles.save(profile)
    return profile
  }

  async createStudentNote({
    id,
    studentId,
    title,
    body,
    visibility = NoteVisibility.Staff,
    createdAt,
  }: {
    id: string
    studentId: string
    title?: string
    body: string
    visibility?: StudentNoteVisibility
    createdAt?: Date
  }): Promise<StudentNote> {
    const { student, classGroupId } = await this.requireStudentManagementContext(studentId)
    await this.authorize('students.manage_notes', {
      schoolId: student.schoolId,
      classGroupId,
      studentId: student.id,
    })
    await this.requireCanWriteNote(visibility)
    const note = new StudentNote({
      id,
      schoolId: student.schoolId,
      studentId: student.id,
      authorStaffId: this.requireStaffActorId(),
      title,
      body,
      visibility,
      createdAt,
      updatedAt: createdAt,
    })
    await this.repositories.studentNotes.save(note)
    return note
  }

  async updateStudentNote({
    noteId,
    title,
    body,
    visibility,
    updatedAt,
  }: {
    noteId: string
    title?: string | null
    body?: string
    visibility?: StudentNoteVisibility
    updatedAt?: Date
  }): Promise<StudentNote> {
    const existing = await this.repositories.studentNotes.findById(noteId)
    if (!existing) {
      denyResourceAccess()
    }
    const { student, classGroupId } = await this.requireStudentManagementContext(existing.studentId)
    if (existing.schoolId !== student.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('students.manage_notes', {
      schoolId: student.schoolId,
      classGroupId,
      studentId: student.id,
    })
    const noteVisibility = visibility ?? existing.visibility
    await this.requireCanWriteNote(noteVisibility)
    if (existing.authorStaffId !== this.requireStaffActorId() && !await this.hasFullStudentRecordAccess()) {
      denyResourceAccess()
    }
    const note = new StudentNote({
      id: existing.id,
      schoolId: existing.schoolId,
      studentId: existing.studentId,
      authorStaffId: existing.authorStaffId,
      title: title === undefined ? existing.title : title,
      body: body ?? existing.body,
      visibility: noteVisibility,
      createdAt: existing.createdAt,
      updatedAt,
    })
    await this.repositories.studentNotes.save(note)
    return note
  }

  async updateGuardianContactMethods({
    guardianId,
    firstName,
    lastName,
    contactMethods,
    hasAccess,
    premiumNotificationsEnabled,
  }: {
    guardianId: string
    firstName?: string
    lastName?: string
    contactMethods?: readonly GuardianContactMethod[]
    hasAccess?: boolean
    premiumNotificationsEnabled?: boolean
  }): Promise<Guardian> {
    const guardian = await this.requireGuardian(guardianId)
    await this.authorize('students.manage_guardians', {
      schoolId: guardian.schoolId,
      guardianId: guardian.id,
    })
    const updated = new Guardian({
      id: guardian.id,
      schoolId: guardian.schoolId,
      firstName: firstName ?? guardian.firstName,
      lastName: lastName ?? guardian.lastName,
      contactMethods: contactMethods ?? guardian.contactMethods,
      hasAccess: hasAccess ?? guardian.hasAccess,
      premiumNotificationsEnabled: premiumNotificationsEnabled ?? guardian.premiumNotificationsEnabled,
      createdAt: guardian.createdAt,
    })
    await this.repositories.guardians.save(updated)
    return updated
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
  }: {
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
    await this.repositories.guardianLinks.save(link)
    return link
  }

  async updateGuardianStudentLink({
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
  }: {
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
  }): Promise<GuardianStudentLink> {
    const existing = await this.repositories.guardianLinks.findByGuardianAndStudent(guardianId, studentId)
    if (!existing) {
      denyResourceAccess()
    }
    const guardian = await this.requireGuardian(guardianId)
    const student = await this.requireStudent(studentId)
    if (guardian.schoolId !== existing.schoolId || student.schoolId !== existing.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('students.manage_guardians', {
      schoolId: existing.schoolId,
      guardianId,
      studentId,
    })
    const updated = new GuardianStudentLink({
      id: existing.id,
      schoolId: existing.schoolId,
      guardianId,
      studentId,
      relationship: relationship ?? existing.relationship,
      isPrimary: isPrimary ?? existing.isPrimary,
      isBillingContact: isBillingContact ?? existing.isBillingContact,
      legalGuardian: legalGuardian ?? existing.legalGuardian,
      canPickup: canPickup ?? existing.canPickup,
      emergencyContactPriority: emergencyContactPriority === undefined
        ? existing.emergencyContactPriority
        : emergencyContactPriority,
      receivesAcademicReports: receivesAcademicReports ?? existing.receivesAcademicReports,
      receivesAttendanceAlerts: receivesAttendanceAlerts ?? existing.receivesAttendanceAlerts,
      contactRestrictions: contactRestrictions === undefined ? existing.contactRestrictions : contactRestrictions,
      notes: notes === undefined ? existing.notes : notes,
      createdAt: existing.createdAt,
    })
    await this.repositories.guardianLinks.save(updated)
    return updated
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

  private async requireStudentManagementContext(
    studentId: string,
  ): Promise<{ student: Student, classGroupId?: string }> {
    const student = await this.requireStudent(studentId)
    const activeEnrollment = await this.repositories.enrollments.findActiveByStudent(student.id)
    if (!activeEnrollment) {
      return { student }
    }
    const classGroup = await this.requireClassGroup(activeEnrollment.classGroupId)
    if (classGroup.schoolId !== student.schoolId) {
      denyResourceAccess()
    }
    return { student, classGroupId: classGroup.id }
  }

  private requireStaffActorId(): string {
    if (this.actor.kind !== 'staff') {
      denyResourceAccess()
    }
    return this.actor.staffMemberId
  }

  private async requireCanWriteNote(visibility: StudentNoteVisibility): Promise<void> {
    this.requireStaffActorId()
    if (visibility === NoteVisibility.AdminOnly && !await this.hasFullStudentRecordAccess()) {
      denyResourceAccess()
    }
  }

  private async hasFullStudentRecordAccess(): Promise<boolean> {
    if (this.actor.kind !== 'staff') {
      return false
    }
    const staffMember = await this.repositories.staffMembers.findById(this.actor.staffMemberId)
    return staffMember?.roles.some(role =>
      role === StaffRole.Admin
      || role === StaffRole.Principal
      || role === StaffRole.Coordinator) ?? false
  }

  private async authorize(
    action: Extract<AuthorizationAction, `students.${string}`>,
    resource: { schoolId: string, classGroupId?: string, studentId?: string, guardianId?: string },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}
