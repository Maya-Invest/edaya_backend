import type { Session } from '../../../entities/scheduling/session'
import type { ClassGroup } from '../../../entities/school/class-group'
import type { StaffMember } from '../../../entities/school/staff-member'
import type { DisciplinaryAction } from '../../../entities/students/disciplinary-action'
import type { Incident } from '../../../entities/students/incident'
import type { Student } from '../../../entities/students/student'
import type { StudentDisciplinaryAction } from '../../../entities/students/student-disciplinary-action'
import type { StudentIncidentInvolvement } from '../../../entities/students/student-incident-involvement'
import type { SchoolRepositories } from '../../../ports/school-repositories'
import type { ServiceArgs } from '../../school-headless-app'
import type { PaginationParams } from '../../shared/pagination'
import { denyResourceAccess } from '../../authorization'
import { paginateSlice } from '../../shared/pagination'

export interface IncidentDisciplinaryActionDetail {
  studentDisciplinaryAction: StudentDisciplinaryAction
  disciplinaryAction: DisciplinaryAction
}

export interface IncidentInvolvementDetail {
  involvement: StudentIncidentInvolvement
  student: Student
  actions: IncidentDisciplinaryActionDetail[]
}

export interface IncidentDetail {
  incident: Incident
  reporter?: StaffMember
  classGroup?: ClassGroup
  session?: Session
  involvements: IncidentInvolvementDetail[]
}

export interface StudentIncidentSummary {
  incident: Incident
  involvement: StudentIncidentInvolvement
  actions: IncidentDisciplinaryActionDetail[]
}

export interface StudentIncidentDirectory {
  student: Student
  rows: StudentIncidentSummary[]
}

export class IncidentReadService {
  constructor(args: ServiceArgs) {
    this.incidents = args.repositories.incidents
    this.studentIncidentInvolvements = args.repositories.studentIncidentInvolvements
    this.studentDisciplinaryActions = args.repositories.studentDisciplinaryActions
    this.disciplinaryActions = args.repositories.disciplinaryActions
    this.students = args.repositories.students
    this.staffMembers = args.repositories.staffMembers
    this.classGroups = args.repositories.classGroups
    this.sessions = args.repositories.sessions
  }

  private readonly incidents: SchoolRepositories['incidents']
  private readonly studentIncidentInvolvements: SchoolRepositories['studentIncidentInvolvements']
  private readonly studentDisciplinaryActions: SchoolRepositories['studentDisciplinaryActions']
  private readonly disciplinaryActions: SchoolRepositories['disciplinaryActions']
  private readonly students: SchoolRepositories['students']
  private readonly staffMembers: SchoolRepositories['staffMembers']
  private readonly classGroups: SchoolRepositories['classGroups']
  private readonly sessions: SchoolRepositories['sessions']

  async getIncidentDetail({
    schoolId,
    incidentId,
  }: {
    schoolId: string
    incidentId: string
  }): Promise<IncidentDetail> {
    const incident = await this.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const [reporter, classGroup, session] = await Promise.all([
      this.staffMembers.findById(incident.reporterId),
      incident.classGroupId ? this.classGroups.findById(incident.classGroupId) : undefined,
      incident.sessionId ? this.sessions.findById(incident.sessionId) : undefined,
    ])
    if (
      (reporter && reporter.schoolId !== schoolId)
      || (incident.classGroupId && (!classGroup || classGroup.schoolId !== schoolId))
      || (incident.sessionId && (!session || session.classGroupId !== incident.classGroupId))
    ) {
      denyResourceAccess()
    }
    const involvements = await this.resolveInvolvements(incident, schoolId)
    return { incident, reporter, classGroup, session, involvements }
  }

  async listStudentIncidents({
    schoolId,
    studentId,
    pagination,
  }: {
    schoolId: string
    studentId: string
    pagination?: PaginationParams
  }): Promise<StudentIncidentDirectory> {
    const student = await this.students.findById(studentId)
    if (!student || student.schoolId !== schoolId) {
      denyResourceAccess()
    }
    const involvements = await this.studentIncidentInvolvements.list({ studentId })
    const rows: StudentIncidentSummary[] = []
    for (const involvement of involvements) {
      const incident = await this.incidents.findById(involvement.incidentId)
      if (!incident || incident.schoolId !== schoolId) {
        denyResourceAccess()
      }
      rows.push({
        incident,
        involvement,
        actions: await this.resolveStudentActions({
          schoolId,
          incidentId: incident.id,
          studentId,
        }),
      })
    }
    rows.sort((left, right) =>
      right.incident.date.getTime() - left.incident.date.getTime()
      || left.incident.id.localeCompare(right.incident.id))
    const paginated = paginateSlice(rows, pagination)
    return { student, rows: paginated }
  }

  private async resolveInvolvements(incident: Incident, schoolId: string): Promise<IncidentInvolvementDetail[]> {
    const involvements = await this.studentIncidentInvolvements.list({ incidentId: incident.id })
    const rows: IncidentInvolvementDetail[] = []
    for (const involvement of involvements) {
      const student = await this.students.findById(involvement.studentId)
      if (!student || student.schoolId !== schoolId) {
        denyResourceAccess()
      }
      rows.push({
        involvement,
        student,
        actions: await this.resolveStudentActions({
          schoolId,
          incidentId: incident.id,
          studentId: student.id,
        }),
      })
    }
    rows.sort((left, right) =>
      left.student.lastName.localeCompare(right.student.lastName)
      || left.student.firstName.localeCompare(right.student.firstName)
      || left.student.id.localeCompare(right.student.id))
    return rows
  }

  private async resolveStudentActions({
    schoolId,
    incidentId,
    studentId,
  }: {
    schoolId: string
    incidentId: string
    studentId: string
  }): Promise<IncidentDisciplinaryActionDetail[]> {
    const appliedActions = await this.studentDisciplinaryActions.list({ incidentId, studentId })
    const rows: IncidentDisciplinaryActionDetail[] = []
    for (const studentDisciplinaryAction of appliedActions) {
      const disciplinaryAction = await this.disciplinaryActions.findById(studentDisciplinaryAction.disciplinaryActionId)
      if (
        !disciplinaryAction
        || disciplinaryAction.schoolId !== schoolId
        || studentDisciplinaryAction.schoolId !== schoolId
      ) {
        denyResourceAccess()
      }
      rows.push({ studentDisciplinaryAction, disciplinaryAction })
    }
    rows.sort((left, right) =>
      left.studentDisciplinaryAction.createdAt.getTime() - right.studentDisciplinaryAction.createdAt.getTime()
      || left.studentDisciplinaryAction.id.localeCompare(right.studentDisciplinaryAction.id))
    return rows
  }
}
