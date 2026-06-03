import type { IncidentKind } from '../../entities/students/incident'
import type { ServiceArgs } from '../../shared/service-args'
import { denyResourceAccess, resolveAuditActorId } from '../../authorization'
import { DisciplinaryActionKind } from '../../entities/students/disciplinary-action'
import { Incident, IncidentStatus } from '../../entities/students/incident'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import {
  StudentDisciplinaryAction,
  StudentDisciplinaryActionStatus,
} from '../../entities/students/student-disciplinary-action'
import { IncidentInvolvementRole, StudentIncidentInvolvement } from '../../entities/students/student-incident-involvement'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireSchool } from '../../shared/require-school'

export class BehaviorService {
  constructor(args: ServiceArgs) {
    this.actor = args.actor
    this.authorizationPolicy = args.authorizationPolicy
    this.repositories = args.repositories
  }

  private readonly actor: ServiceArgs['actor']
  private readonly authorizationPolicy: ServiceArgs['authorizationPolicy']
  private readonly repositories: ServiceArgs['repositories']

  async recordIncident({
    id,
    schoolId,
    title,
    description,
    date,
    kind,
    classGroupId,
    sessionId,
    createdAt,
  }: {
    id: string
    schoolId: string
    title: string
    description: string
    date: Date
    kind: IncidentKind
    classGroupId?: string
    sessionId?: string
    createdAt?: Date
  }): Promise<Incident> {
    await requireSchool(this.repositories.schools, schoolId)
    const context = await this.resolveIncidentContext({ schoolId, classGroupId, sessionId })
    await this.authorize('behavior.report_incident', {
      schoolId,
      classGroupId: context.classGroupId,
      sessionId: context.sessionId,
    })
    const incident = new Incident({
      id,
      schoolId,
      title,
      description,
      date,
      kind,
      reporterId: resolveAuditActorId(this.actor),
      classGroupId: context.classGroupId,
      sessionId: context.sessionId,
      createdAt,
    })
    await this.repositories.incidents.save(incident)
    return incident
  }

  async addStudentInvolvement({
    id,
    incidentId,
    studentId,
    role,
    notes,
    createdAt,
  }: {
    id: string
    incidentId: string
    studentId: string
    role: IncidentInvolvementRole
    notes?: string
    createdAt?: Date
  }): Promise<StudentIncidentInvolvement> {
    const incident = await this.requireIncident(incidentId)
    await this.authorize('behavior.report_incident', {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      sessionId: incident.sessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const existing = (await this.repositories.studentIncidentInvolvements.list({ incidentId, studentId }))[0]
    if (existing) {
      throw new BusinessRuleViolationError('STUDENT_ALREADY_LINKED_TO_INCIDENT', `Student ${studentId} is already linked to incident ${incidentId}`)
    }
    const involvement = new StudentIncidentInvolvement({ id, incidentId, studentId, role, notes, createdAt })
    await this.repositories.studentIncidentInvolvements.save(involvement)
    return involvement
  }

  async applyDisciplinaryAction({
    id,
    incidentId,
    studentId,
    disciplinaryActionId,
    startsAt,
    endsAt,
    notes,
    createdAt,
  }: {
    id: string
    incidentId: string
    studentId: string
    disciplinaryActionId: string
    startsAt?: Date
    endsAt?: Date
    notes?: string
    createdAt?: Date
  }): Promise<StudentDisciplinaryAction> {
    const incident = await this.requireIncident(incidentId)
    await this.authorize('behavior.manage_discipline', {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      sessionId: incident.sessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const [catalogAction, involvement] = await Promise.all([
      this.repositories.disciplinaryActions.findById(disciplinaryActionId),
      this.repositories.studentIncidentInvolvements.list({ incidentId, studentId }),
    ])
    if (!catalogAction || catalogAction.schoolId !== incident.schoolId || involvement.length === 0) {
      denyResourceAccess()
    }
    const applied = new StudentDisciplinaryAction({
      id,
      schoolId: incident.schoolId,
      incidentId,
      studentId,
      disciplinaryActionId,
      assignedByStaffId: resolveAuditActorId(this.actor),
      startsAt,
      endsAt,
      notes,
      createdAt,
    })
    await this.repositories.studentDisciplinaryActions.save(applied)
    return applied
  }

  async updateStudentDisciplinaryActionStatus({
    studentDisciplinaryActionId,
    status,
    updatedAt,
  }: {
    studentDisciplinaryActionId: string
    status: StudentDisciplinaryActionStatus
    updatedAt?: Date
  }): Promise<StudentDisciplinaryAction> {
    const current = await this.repositories.studentDisciplinaryActions.findById(studentDisciplinaryActionId)
    if (!current || current.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    const incident = await this.requireIncident(current.incidentId)
    await this.authorize('behavior.manage_discipline', {
      schoolId: current.schoolId,
      classGroupId: incident.classGroupId,
      sessionId: incident.sessionId,
      studentId: current.studentId,
    })
    const updated = new StudentDisciplinaryAction({
      id: current.id,
      schoolId: current.schoolId,
      incidentId: current.incidentId,
      studentId: current.studentId,
      disciplinaryActionId: current.disciplinaryActionId,
      assignedByStaffId: current.assignedByStaffId,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      status,
      notes: current.notes,
      createdAt: current.createdAt,
      updatedAt: updatedAt ?? new Date(),
    })
    await this.repositories.studentDisciplinaryActions.save(updated)
    return updated
  }

  async resolveIncident({
    incidentId,
    resolutionNotes,
    resolvedAt,
  }: {
    incidentId: string
    resolutionNotes?: string
    resolvedAt?: Date
  }): Promise<Incident> {
    const current = await this.requireIncident(incidentId)
    await this.authorize('behavior.manage_discipline', {
      schoolId: current.schoolId,
      classGroupId: current.classGroupId,
      sessionId: current.sessionId,
    })
    if (current.status !== IncidentStatus.Open) {
      throw new BusinessRuleViolationError('INCIDENT_NOT_OPEN', `Incident ${incidentId} is not open`)
    }
    const resolvedTime = resolvedAt ?? new Date()
    const resolved = new Incident({
      id: current.id,
      schoolId: current.schoolId,
      title: current.title,
      description: current.description,
      date: current.date,
      kind: current.kind,
      reporterId: current.reporterId,
      classGroupId: current.classGroupId,
      sessionId: current.sessionId,
      status: IncidentStatus.Resolved,
      resolutionNotes,
      resolvedAt: resolvedTime,
      resolvedByStaffId: resolveAuditActorId(this.actor),
      createdAt: current.createdAt,
      updatedAt: resolvedTime,
    })
    await this.repositories.incidents.save(resolved)
    return resolved
  }

  private async requireIncident(incidentId: string): Promise<Incident> {
    const incident = await this.repositories.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    return incident
  }

  private async resolveIncidentContext({
    schoolId,
    classGroupId,
    sessionId,
  }: {
    schoolId: string
    classGroupId?: string
    sessionId?: string
  }): Promise<{ classGroupId?: string, sessionId?: string }> {
    if (sessionId) {
      const session = await this.repositories.sessions.findById(sessionId)
      const classGroup = session ? await this.repositories.classGroups.findById(session.classGroupId) : undefined
      if (!session || !classGroup || classGroup.schoolId !== schoolId || (classGroupId && classGroup.id !== classGroupId)) {
        denyResourceAccess()
      }
      return { classGroupId: classGroup.id, sessionId: session.id }
    }
    if (classGroupId) {
      const classGroup = await this.repositories.classGroups.findById(classGroupId)
      if (!classGroup || classGroup.schoolId !== schoolId) {
        denyResourceAccess()
      }
      return { classGroupId: classGroup.id }
    }
    return {}
  }

  private async requireStudentInIncidentScope(studentId: string, incident: Incident): Promise<void> {
    const student = await this.repositories.students.findById(studentId)
    if (!student || student.schoolId !== incident.schoolId) {
      denyResourceAccess()
    }
    if (incident.classGroupId) {
      const enrollments = await this.repositories.enrollments.list({
        studentId,
        classGroupId: incident.classGroupId,
        status: StudentClassEnrollmentStatus.Active,
      })
      if (enrollments.length === 0) {
        throw new BusinessRuleViolationError('ACTIVE_ENROLLMENT_REQUIRED', `Student ${studentId} does not have an active enrollment in classGroup ${incident.classGroupId}`)
      }
    }
  }

  private async authorize(
    action: 'behavior.report_incident' | 'behavior.manage_discipline',
    resource: {
      schoolId: string
      classGroupId?: string
      sessionId?: string
      studentId?: string
    },
  ): Promise<void> {
    if (resource.schoolId !== this.actor.schoolId) {
      denyResourceAccess()
    }
    switch (action) {
      case 'behavior.report_incident':
        if (resource.classGroupId) {
          await this.authorizationPolicy.checkClassGroupAccess(this.actor, [resource.classGroupId])
        }
        else if (resource.sessionId) {
          await this.authorizationPolicy.checkSessionAccess(this.actor, [resource.sessionId])
        }
        else {
          await this.authorizationPolicy.checkGlobalAction(this.actor, 'behavior.report_incident')
        }
        if (resource.studentId) {
          await this.authorizationPolicy.checkStudentAccess(this.actor, [resource.studentId])
        }
        break
      case 'behavior.manage_discipline':
        if (resource.classGroupId) {
          await this.authorizationPolicy.checkClassGroupAccess(this.actor, [resource.classGroupId])
        }
        else if (resource.sessionId) {
          await this.authorizationPolicy.checkSessionAccess(this.actor, [resource.sessionId])
        }
        else {
          await this.authorizationPolicy.checkGlobalAction(this.actor, 'behavior.manage_discipline')
        }
        if (resource.studentId) {
          await this.authorizationPolicy.checkStudentAccess(this.actor, [resource.studentId])
        }
        break
    }
  }
}

export { DisciplinaryActionKind, IncidentInvolvementRole, StudentDisciplinaryActionStatus }
