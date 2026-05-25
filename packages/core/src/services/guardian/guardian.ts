import type { School } from '../../entities/school/school'
import type { GuardianContactMethod } from '../../entities/students/guardian-contact-method'
import type { Student } from '../../entities/students/student'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { GuardianRepository } from '../../ports/guardian-repository'
import type { GuardianStudentLinkRepository } from '../../ports/guardian-student-link-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentRepository } from '../../ports/student-repository'
import { Guardian } from '../../entities/students/guardian'
import { GuardianStudentLink } from '../../entities/students/guardian-student-link'

export interface GuardianServiceArgs {
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
}

export class GuardianService {
  constructor(args: GuardianServiceArgs) {
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
    await this.requireStudent(studentId)

    const enrollments = await this.enrollments.listByStudent(studentId)
    const isEnrolledInSchool = await Promise.all(
      enrollments.map(async (enrollment) => {
        const classGroup = await this.classGroups.findById(enrollment.classGroupId)
        return classGroup?.schoolId === guardian.schoolId
      }),
    ).then(results => results.some(result => result))

    if (!isEnrolledInSchool) {
      throw new Error(`Student ${studentId} is not enrolled in school ${guardian.schoolId}`)
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
      throw new Error(`Unknown student: ${studentId}`)
    }
    return student
  }

  private async requireGuardian(guardianId: string): Promise<Guardian> {
    const guardian = await this.guardians.findById(guardianId)
    if (!guardian) {
      throw new Error(`Unknown guardian: ${guardianId}`)
    }
    return guardian
  }
}
