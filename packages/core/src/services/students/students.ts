import type { ClassGroupRepository } from '../../ports/class-group-repository'
import type { GuardianRepository } from '../../ports/guardian-repository'
import type { GuardianStudentLinkRepository } from '../../ports/guardian-student-link-repository'
import type { SchoolRepository } from '../../ports/school-repository'
import type { StudentClassEnrollmentRepository } from '../../ports/student-enrollment-repository'
import type { StudentRepository } from '../../ports/student-repository'
import { GuardianService } from '../guardian/guardian'
import { StudentService } from '../workspace/student'

export interface StudentsServiceArgs {
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  StudentClassEnrollmentRepository: StudentClassEnrollmentRepository
  guardianRepository: GuardianRepository
  guardianStudentLinkRepository: GuardianStudentLinkRepository
}

export class StudentsService {
  private readonly students: StudentService
  private readonly guardians: GuardianService

  constructor(args: StudentsServiceArgs) {
    this.students = new StudentService(args)
    this.guardians = new GuardianService(args)
  }

  registerStudent(input: Parameters<StudentService['registerStudent']>[0]) {
    return this.students.registerStudent(input)
  }

  enrollStudent(input: Parameters<StudentService['enrollStudent']>[0]) {
    return this.students.enrollStudent(input)
  }

  registerGuardian(input: Parameters<GuardianService['registerGuardian']>[0]) {
    return this.guardians.registerGuardian(input)
  }

  linkGuardianToStudent(input: Parameters<GuardianService['linkGuardianToStudent']>[0]) {
    return this.guardians.linkGuardianToStudent(input)
  }
}
