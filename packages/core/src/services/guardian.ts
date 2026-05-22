import type { GuardianContactMethod } from '$lib/core/entities/guardian-contact-method'
import type { School } from '$lib/core/entities/school'
import type { Student } from '$lib/core/entities/student'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { GuardianRepository } from '$lib/core/ports/guardian-repository'
import type { GuardianStudentLinkRepository } from '$lib/core/ports/guardian-student-link-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { Guardian } from '$lib/core/entities/guardian'
import { GuardianStudentLink } from '$lib/core/entities/guardian-student-link'

export interface GuardianServiceArgs {
  schoolRepository: SchoolRepository
  classroomRepository: ClassroomRepository
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
}

export class GuardianService {
  constructor(args: GuardianServiceArgs) {
    this.schools = args.schoolRepository
    this.classrooms = args.classroomRepository
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
    this.guardians = args.guardianRepository
    this.guardianStudentLinks = args.guardianStudentLinkRepository
  }

  private readonly schools: SchoolRepository
  private readonly classrooms: ClassroomRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository
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
        const classroom = await this.classrooms.findById(enrollment.classroomId)
        return classroom?.schoolId === guardian.schoolId
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

  async listStudentsForGuardian(guardianId: string): Promise<Student[]> {
    await this.requireGuardian(guardianId)
    const links = await this.guardianStudentLinks.listByGuardian(guardianId)
    const students: Student[] = []
    for (const link of links) {
      const student = await this.students.findById(link.studentId)
      if (student) {
        students.push(student)
      }
    }
    return students
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
