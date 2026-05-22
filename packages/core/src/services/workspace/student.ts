import type { Classroom } from '$lib/core/entities/classroom'
import type { School } from '$lib/core/entities/school'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { Student } from '$lib/core/entities/student'
import { StudentEnrollment } from '$lib/core/entities/student-enrollment'

export interface StudentServiceArgs {
  schoolRepository: SchoolRepository
  classroomRepository: ClassroomRepository
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
}

export class StudentService {
  constructor(args: StudentServiceArgs) {
    this.schools = args.schoolRepository
    this.classrooms = args.classroomRepository
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
  }

  private readonly schools: SchoolRepository
  private readonly classrooms: ClassroomRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository

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
    classroomId,
    createdAt,
  }: {
    id: string
    studentId: string
    classroomId: string
    createdAt?: Date
  }): Promise<StudentEnrollment> {
    await this.requireStudent(studentId)
    const classroom = await this.requireClassroom(classroomId)

    const existingEnrollments = await this.enrollments.listByStudent(studentId)
    const existing = existingEnrollments.find(enrollment => enrollment.classroomId === classroomId)
    const nextEnrollmentIndex
      = existing?.enrollmentIndex
        ?? Math.max(0, ...existingEnrollments.map(enrollment => enrollment.enrollmentIndex)) + 1

    const enrollment = new StudentEnrollment({
      id: existing?.id ?? id,
      studentId,
      classroomId,
      academicYearId: classroom.academicYearId,
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

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
  }
}
