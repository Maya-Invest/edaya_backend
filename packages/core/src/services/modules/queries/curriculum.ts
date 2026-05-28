import type { ClassSubject } from '../../../entities/academics/class-subject'
import type { ClassSubjectMatter } from '../../../entities/academics/class-subject-matter'
import type { ClassSubjectProgress } from '../../../entities/academics/class-subject-progress'
import type { Subject } from '../../../entities/academics/subject'
import type { SubjectMatter } from '../../../entities/academics/subject-matter'
import type { Session } from '../../../entities/scheduling/session'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { StaffMember } from '../../../entities/school/staff-member'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import { StaffRole } from '../../../entities/school/staff-member'
import { denyResourceAccess } from '../../authorization'

export interface CurriculumProgressHistoryEntry {
  progress: ClassSubjectProgress
  session: Session
}

export interface CurriculumMatterProgressDetail {
  classSubjectMatter: ClassSubjectMatter
  subjectMatter: SubjectMatter
  history: CurriculumProgressHistoryEntry[]
}

export interface ClassSubjectProgressDetail {
  classGroup: ClassGroup
  classSubject: ClassSubject
  subject: Subject
  teacher?: StaffMember
  matters: CurriculumMatterProgressDetail[]
}

export class CurriculumProgressReadService {
  constructor(args: ServiceArgs) {
    this.classGroups = args.repositories.classGroups
    this.classSubjects = args.repositories.classSubjects
    this.subjects = args.repositories.subjects
    this.classSubjectMatters = args.repositories.classSubjectMatters
    this.subjectMatters = args.repositories.subjectMatters
    this.classSubjectProgress = args.repositories.classSubjectProgress
    this.sessions = args.repositories.sessions
    this.staffAssignments = args.repositories.staffAssignments
    this.staffMembers = args.repositories.staffMembers
  }

  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly classSubjects: SchoolRepositories['classSubjects']
  private readonly subjects: SchoolRepositories['subjects']
  private readonly classSubjectMatters: SchoolRepositories['classSubjectMatters']
  private readonly subjectMatters: SchoolRepositories['subjectMatters']
  private readonly classSubjectProgress: SchoolRepositories['classSubjectProgress']
  private readonly sessions: SchoolRepositories['sessions']
  private readonly staffAssignments: SchoolRepositories['staffAssignments']
  private readonly staffMembers: SchoolRepositories['staffMembers']

  async getClassSubjectProgressDetail({
    schoolId,
    classSubjectId,
  }: {
    schoolId: string
    classSubjectId: string
  }): Promise<ClassSubjectProgressDetail> {
    const classSubject = await this.classSubjects.findById(classSubjectId)
    const [classGroup, subject] = classSubject
      ? await Promise.all([
          this.classGroups.findById(classSubject.classGroupId),
          this.subjects.findById(classSubject.subjectId),
        ])
      : []
    if (
      !classSubject
      || !classGroup
      || !subject
      || classGroup.schoolId !== schoolId
      || subject.schoolId !== schoolId
    ) {
      denyResourceAccess()
    }

    const [teacher, assignedMatters] = await Promise.all([
      this.resolveTeacher(classSubject.id, schoolId),
      this.classSubjectMatters.list({ classSubjectId: classSubject.id }),
    ])
    const matters = await Promise.all(
      assignedMatters.map(async (classSubjectMatter) => {
        const subjectMatter = await this.subjectMatters.findById(classSubjectMatter.subjectMatterId)
        if (!subjectMatter || subjectMatter.subjectId !== subject.id) {
          denyResourceAccess()
        }
        const progressRecords = await this.classSubjectProgress.list({ classSubjectMatterId: classSubjectMatter.id })
        const history = await Promise.all(
          progressRecords.map(async (progress) => {
            const session = await this.sessions.findById(progress.sessionId)
            if (
              !session
              || session.classGroupId !== classGroup.id
              || session.classSubjectId !== classSubject.id
            ) {
              denyResourceAccess()
            }
            return { progress, session }
          }),
        )
        history.sort((left, right) =>
          left.session.startsAt.getTime() - right.session.startsAt.getTime()
          || left.progress.recordedAt.getTime() - right.progress.recordedAt.getTime()
          || left.session.id.localeCompare(right.session.id)
          || left.progress.id.localeCompare(right.progress.id))
        return { classSubjectMatter, subjectMatter, history }
      }),
    )
    matters.sort((left, right) =>
      left.subjectMatter.sequenceOrder - right.subjectMatter.sequenceOrder
      || left.subjectMatter.name.localeCompare(right.subjectMatter.name)
      || left.subjectMatter.id.localeCompare(right.subjectMatter.id))

    return { classGroup, classSubject, subject, teacher, matters }
  }

  private async resolveTeacher(classSubjectId: string, schoolId: string): Promise<StaffMember | undefined> {
    const assignments = await this.staffAssignments.list({ classSubjectId })
    const teacherAssignment = assignments.find(assignment => assignment.role === StaffRole.Teacher)
    if (!teacherAssignment) {
      return undefined
    }
    const teacher = await this.staffMembers.findById(teacherAssignment.staffId)
    if (!teacher || teacher.schoolId !== schoolId) {
      denyResourceAccess()
    }
    return teacher
  }
}
