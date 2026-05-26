import type { ClassGroup } from '../../entities/school/class-group'
import type { School } from '../../entities/school/school'
import type { GuardianContactMethod } from '../../entities/students/guardian-contact-method'
import type { SchoolRepositories } from '../../ports/school-repositories'
import type { AuthorizedServiceArgs } from '../authorization'
import { Guardian } from '../../entities/students/guardian'
import { GuardianStudentLink } from '../../entities/students/guardian-student-link'
import { Student } from '../../entities/students/student'
import { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'
import { denyResourceAccess } from '../authorization'

export interface StudentsServiceArgs extends AuthorizedServiceArgs {
  repositories: SchoolRepositories
}

export class StudentsService {
  constructor(args: StudentsServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.schools = args.repositories.schools
    this.classGroups = args.repositories.classGroups
    this.students = args.repositories.students
    this.enrollments = args.repositories.enrollments
    this.guardians = args.repositories.guardians
    this.guardianStudentLinks = args.repositories.guardianLinks
  }

  private readonly schools: SchoolRepositories['schools']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly students: SchoolRepositories['students']
  private readonly enrollments: SchoolRepositories['enrollments']
  private readonly guardians: SchoolRepositories['guardians']
  private readonly guardianStudentLinks: SchoolRepositories['guardianLinks']
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

    const existingEnrollments = await this.enrollments.list({ studentId })
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

    const enrollments = await this.enrollments.list({ studentId })
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
