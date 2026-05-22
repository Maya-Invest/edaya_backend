import type { Classroom } from '$lib/core/entities/classroom'
import type { DeadlineComplianceStatus } from '$lib/core/entities/deadline-record'
import type { Module } from '$lib/core/entities/module'
import type { School } from '$lib/core/entities/school'
import type { Student } from '$lib/core/entities/student'
import type { ClassroomRepository } from '$lib/core/ports/classroom-repository'
import type { DeadlineRecordRepository } from '$lib/core/ports/deadline-record-repository'
import type { DeadlineRepository } from '$lib/core/ports/deadline-repository'
import type { ModuleRepository } from '$lib/core/ports/module-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { Deadline } from '$lib/core/entities/deadline'
import { DeadlineRecord } from '$lib/core/entities/deadline-record'

export interface DeadlineServiceArgs {
  schoolRepository: SchoolRepository
  classroomRepository: ClassroomRepository
  moduleRepository: ModuleRepository
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  deadlineRepository: DeadlineRepository
  deadlineRecordRepository: DeadlineRecordRepository
}

export class DeadlineService {
  constructor(args: DeadlineServiceArgs) {
    this.schools = args.schoolRepository
    this.classrooms = args.classroomRepository
    this.modules = args.moduleRepository
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
    this.deadlines = args.deadlineRepository
    this.records = args.deadlineRecordRepository
  }

  private readonly schools: SchoolRepository
  private readonly classrooms: ClassroomRepository
  private readonly modules: ModuleRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly deadlines: DeadlineRepository
  private readonly records: DeadlineRecordRepository

  async createDeadline({
    id,
    schoolId,
    title,
    dueAt,
    classroomId,
    moduleId,
    metAt,
    createdAt,
  }: {
    id: string
    schoolId: string
    title: string
    dueAt: Date
    classroomId?: string | null
    moduleId?: string | null
    metAt?: Date
    createdAt?: Date
  }): Promise<Deadline> {
    await this.requireSchool(schoolId)
    const classroom = classroomId ? await this.requireClassroom(classroomId) : undefined
    const module = moduleId ? await this.requireModule(moduleId) : undefined

    if (classroom && classroom.schoolId !== schoolId) {
      throw new Error(`Classroom ${classroomId} does not belong to school ${schoolId}`)
    }
    if (module) {
      const moduleClassroom = await this.requireClassroom(module.classroomId)
      if (moduleClassroom.schoolId !== schoolId) {
        throw new Error(`Module ${moduleId} does not belong to school ${schoolId}`)
      }
      if (classroom && module.classroomId !== classroom.id) {
        throw new Error(`Module ${moduleId} does not belong to classroom ${classroom.id}`)
      }
    }

    const deadline = new Deadline({
      id,
      schoolId,
      title,
      dueAt,
      classroomId,
      moduleId,
      metAt,
      createdAt,
    })
    await this.deadlines.save(deadline)
    return deadline
  }

  async completeDeadline({
    deadlineId,
    metAt,
  }: {
    deadlineId: string
    metAt?: Date
  }): Promise<Deadline> {
    const existing = await this.requireDeadline(deadlineId)
    const completed = new Deadline({
      id: existing.id,
      schoolId: existing.schoolId,
      title: existing.title,
      dueAt: existing.dueAt,
      classroomId: existing.classroomId,
      moduleId: existing.moduleId,
      metAt: metAt ?? new Date(),
      createdAt: existing.createdAt,
    })
    await this.deadlines.save(completed)
    return completed
  }

  async recordDeadlineCompliance({
    id,
    studentId,
    deadlineId,
    status,
    notes,
    createdBy,
    createdAt,
  }: {
    id: string
    studentId: string
    deadlineId: string
    status: DeadlineComplianceStatus
    notes?: string | null
    createdBy?: string
    createdAt?: Date
  }): Promise<DeadlineRecord> {
    await this.requireStudent(studentId)
    const deadline = await this.requireDeadline(deadlineId)
    await this.requireStudentEligibilityForDeadline({ studentId, deadline })

    const existing = await this.records.findByStudentAndDeadline(studentId, deadlineId)
    const record = new DeadlineRecord({
      id: existing?.id ?? id,
      studentId,
      deadlineId,
      status,
      notes,
      createdBy: createdBy ?? existing?.createdBy,
      createdAt: existing?.createdAt ?? createdAt,
    })
    await this.records.save(record)
    return record
  }

  async listSchoolDeadlines(schoolId: string): Promise<Deadline[]> {
    await this.requireSchool(schoolId)
    return this.deadlines.listBySchool(schoolId)
  }

  async listClassroomDeadlines(classroomId: string): Promise<Deadline[]> {
    await this.requireClassroom(classroomId)
    return this.deadlines.listByClassroom(classroomId)
  }

  async listModuleDeadlines(moduleId: string): Promise<Deadline[]> {
    await this.requireModule(moduleId)
    return this.deadlines.listByModule(moduleId)
  }

  async listDeadlineCompliance(deadlineId: string): Promise<DeadlineRecord[]> {
    await this.requireDeadline(deadlineId)
    return this.records.listByDeadline(deadlineId)
  }

  async listStudentDeadlineRecords(studentId: string): Promise<DeadlineRecord[]> {
    await this.requireStudent(studentId)
    return this.records.listByStudent(studentId)
  }

  private async requireSchool(schoolId: string): Promise<School> {
    const school = await this.schools.findById(schoolId)
    if (!school) {
      throw new Error(`Unknown school: ${schoolId}`)
    }
    return school
  }

  private async requireClassroom(classroomId: string): Promise<Classroom> {
    const classroom = await this.classrooms.findById(classroomId)
    if (!classroom) {
      throw new Error(`Unknown classroom: ${classroomId}`)
    }
    return classroom
  }

  private async requireModule(moduleId: string): Promise<Module> {
    const module = await this.modules.findById(moduleId)
    if (!module) {
      throw new Error(`Unknown module: ${moduleId}`)
    }
    return module
  }

  private async requireStudent(studentId: string): Promise<Student> {
    const student = await this.students.findById(studentId)
    if (!student) {
      throw new Error(`Unknown student: ${studentId}`)
    }
    return student
  }

  private async requireDeadline(deadlineId: string): Promise<Deadline> {
    const deadline = await this.deadlines.findById(deadlineId)
    if (!deadline) {
      throw new Error(`Unknown deadline: ${deadlineId}`)
    }
    return deadline
  }

  private async requireStudentEligibilityForDeadline({
    studentId,
    deadline,
  }: {
    studentId: string
    deadline: Deadline
  }): Promise<void> {
    const enrollments = await this.enrollments.listByStudent(studentId)
    if (!deadline.classroomId && !deadline.moduleId) {
      return
    }

    const targetClassroomId = deadline.classroomId
      ? deadline.classroomId
      : deadline.moduleId
        ? (await this.requireModule(deadline.moduleId)).classroomId
        : undefined

    if (targetClassroomId && !enrollments.some(enrollment => enrollment.classroomId === targetClassroomId)) {
      throw new Error(`Student ${studentId} is not eligible for deadline ${deadline.id}`)
    }
  }
}
