import type { DeadlineComplianceStatus } from '$lib/core/entities/assessments/deadline-record'
import type { ClassGroup } from '$lib/core/entities/core/class-group'
import type { School } from '$lib/core/entities/core/school'
import type { Student } from '$lib/core/entities/core/student'
import type { ClassGroupRepository } from '$lib/core/ports/class-group-repository'
import type { DeadlineRecordRepository } from '$lib/core/ports/deadline-record-repository'
import type { DeadlineRepository } from '$lib/core/ports/deadline-repository'
import type { SchoolRepository } from '$lib/core/ports/school-repository'
import type { StudentEnrollmentRepository } from '$lib/core/ports/student-enrollment-repository'
import type { StudentRepository } from '$lib/core/ports/student-repository'
import { Deadline } from '$lib/core/entities/assessments/deadline'
import { DeadlineRecord } from '$lib/core/entities/assessments/deadline-record'

export interface DeadlineServiceArgs {
  schoolRepository: SchoolRepository
  classGroupRepository: ClassGroupRepository
  studentRepository: StudentRepository
  studentEnrollmentRepository: StudentEnrollmentRepository
  deadlineRepository: DeadlineRepository
  deadlineRecordRepository: DeadlineRecordRepository
}

export class DeadlineService {
  constructor(args: DeadlineServiceArgs) {
    this.schools = args.schoolRepository
    this.classGroups = args.classGroupRepository
    this.students = args.studentRepository
    this.enrollments = args.studentEnrollmentRepository
    this.deadlines = args.deadlineRepository
    this.records = args.deadlineRecordRepository
  }

  private readonly schools: SchoolRepository
  private readonly classGroups: ClassGroupRepository
  private readonly students: StudentRepository
  private readonly enrollments: StudentEnrollmentRepository
  private readonly deadlines: DeadlineRepository
  private readonly records: DeadlineRecordRepository

  async createDeadline({
    id,
    schoolId,
    title,
    dueAt,
    classGroupId,
    classSubjectId,
    metAt,
    createdAt,
  }: {
    id: string
    schoolId: string
    title: string
    dueAt: Date
    classGroupId?: string | null
    classSubjectId?: string | null
    metAt?: Date
    createdAt?: Date
  }): Promise<Deadline> {
    await this.requireSchool(schoolId)
    const classGroup = classGroupId ? await this.requireClassGroup(classGroupId) : undefined

    if (classGroup && classGroup.schoolId !== schoolId) {
      throw new Error(`ClassGroup ${classGroupId} does not belong to school ${schoolId}`)
    }
    if (classSubjectId && !classGroupId) {
      throw new Error('classGroupId is required when classSubjectId is provided')
    }

    const deadline = new Deadline({
      id,
      schoolId,
      title,
      dueAt,
      classGroupId,
      classSubjectId,
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
      classGroupId: existing.classGroupId,
      classSubjectId: existing.classSubjectId,
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

  async listClassGroupDeadlines(classGroupId: string): Promise<Deadline[]> {
    await this.requireClassGroup(classGroupId)
    return this.deadlines.listByClassGroup(classGroupId)
  }

  async listClassSubjectDeadlines(classSubjectId: string): Promise<Deadline[]> {
    return this.deadlines.listByClassSubject(classSubjectId)
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

  private async requireClassGroup(classGroupId: string): Promise<ClassGroup> {
    const classGroup = await this.classGroups.findById(classGroupId)
    if (!classGroup) {
      throw new Error(`Unknown classGroup: ${classGroupId}`)
    }
    return classGroup
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
    if (!deadline.classGroupId) {
      return
    }

    const targetClassGroupId = deadline.classGroupId

    if (targetClassGroupId && !enrollments.some(enrollment => enrollment.classGroupId === targetClassGroupId)) {
      throw new Error(`Student ${studentId} is not eligible for deadline ${deadline.id}`)
    }
  }
}
