import type { ClassGroup } from '../../entities/school/class-group'
import type { School } from '../../entities/school/school'
import type { GuardianContactMethod } from '../../entities/students/guardian-contact-method'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { GuardianRepository } from '../../ports/guardian-repository'
import type { GuardianStudentLinkRepository } from '../../ports/guardian-student-link-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentRepository } from '../../ports/student-repository'
import type { AuthorizedServiceArgs } from '../authorization'
import { Guardian } from '../../entities/students/guardian'
import { GuardianStudentLink } from '../../entities/students/guardian-student-link'
import { Student } from '../../entities/students/student'
import { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import { denyResourceAccess } from '../authorization'

export interface StudentsServiceArgs extends AuthorizedServiceArgs {
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
}

export class StudentsService {
  constructor(args: StudentsServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.schools = args.schoolRepository
    this.classGroups = args.classGroupRepository
    this.students = args.studentRepository
    this.enrollments = args.StudentClassEnrollmentRepository
    this.guardians = args.guardianRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
  }

  private readonly schools: SchoolRepository
  private readonly classGroups: ClassGroupRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentClassEnrollmentRepository
  private readonly guardians: GuardianRepository
  private readonly guardianStudentLinks: GuardianStudentLinkRepository
  private readonly actor: AuthorizedServiceArgs['actor']
  private readonly authorizationPolicy: AuthorizedServiceArgs['authorizationPolicy']

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
    await this.students.save(student)
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
    if (student.schoolId !== classGroup.schoolId) {
      denyResourceAccess()
    }
    await this.authorize('students.manage_enrollment', {
      schoolId: classGroup.schoolId,
      classGroupId,
      studentId: student.id,
    })

    const existingEnrollments = await this.enrollments.listByStudent(studentId)
    const existing = existingEnrollments.find(enrollment => enrollment.classGroupId === classGroupId)
    const nextEnrollmentIndex
      = existing?.enrollmentIndex
        ?? Math.max(0, ...existingEnrollments.map(enrollment => enrollment.enrollmentIndex)) + 1

    const enrollment = new StudentClassEnrollment({
      id: existing?.id ?? id,
      studentId,
      classGroupId,
      academicYearId: classGroup.academicYearId,
      enrollmentIndex: nextEnrollmentIndex,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.enrollments.save(enrollment)
    return enrollment
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
    await this.guardians.save(guardian)
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

    const enrollments = await this.enrollments.listByStudent(studentId)
    const isEnrolledInSchool = await Promise.all(
      enrollments.map(async (enrollment) => {
        const classGroup = await this.classGroups.findById(enrollment.classGroupId)
        return classGroup?.schoolId === guardian.schoolId
      }),
    ).then(results => results.some(result => result))

    if (!isEnrolledInSchool) {
      denyResourceAccess()
    }

    const existing = await this.guardianStudentLinks.findByGuardianAndStudent(guardianId, studentId)
    const link = new GuardianStudentLink({
      id: existing?.id ?? id,
      schoolId: guardian.schoolId,
      guardianId,
      studentId,
      relationship,
      isPrimary,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.guardianStudentLinks.save(link)
    return link
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async requireStudent(studentId: string): Promise<Student> {
    const student = await this.students.findById(studentId)
    if (!student) {
      denyResourceAccess()
    }
    return student
  }

  private async requireGuardian(guardianId: string): Promise<Guardian> {
    const guardian = await this.guardians.findById(guardianId)
    if (!guardian) {
      denyResourceAccess()
    }
    return guardian
  }

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      denyResourceAccess()
    }
    return classGroup
  }

  private async authorize(
    action: 'students.manage_enrollment' | 'students.manage_guardians',
    resource: { schoolId: string, classGroupId?: string, studentId?: string, guardianId?: string },
  ): Promise<void> {
    await this.authorizationPolicy.requirePermission(this.actor, { action, resource })
  }
}
