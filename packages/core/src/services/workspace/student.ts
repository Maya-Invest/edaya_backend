import type { ClassGroup } from '../../entities/school/class-group'
import type { School } from '../../entities/school/school'
import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentRepository } from '../../ports/student-repository'
import { Student } from '../../entities/students/student'
import { StudentClassEnrollment } from '../../entities/students/student-class-enrollment'

export interface StudentServiceArgs {
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
}

export class StudentService {
  constructor(args: StudentServiceArgs) {
    this.schools = args.schoolRepository
    this.classGroups = args.classGroupRepository
    this.students = args.studentRepository
    this.enrollments = args.StudentClassEnrollmentRepository
  }

  private readonly schools: SchoolRepository
  private readonly classGroups: ClassGroupRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentClassEnrollmentRepository

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
    await this.requireStudent(studentId)
    const classGroup = await this.requireClassGroup(classGroupId)

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

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
  }
}
