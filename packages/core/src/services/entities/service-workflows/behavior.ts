import type { IncidentKind } from '../../../entities/students/incident'
import type { IncidentInvolvementRole } from '../../../entities/students/student-incident-involvement'
import type { BaseSchoolService } from '../base-school-service'
import { DisciplinaryActionKind } from '../../../entities/students/disciplinary-action'
import { Incident, IncidentStatus } from '../../../entities/students/incident'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import {
  StudentDisciplinaryAction,
  StudentDisciplinaryActionStatus,
} from '../../../entities/students/student-disciplinary-action'
import { StudentIncidentInvolvement } from '../../../entities/students/student-incident-involvement'
import { denyResourceAccess, resolveAuditActorId } from '../../authorization'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { requireSchool } from '../../shared/require-school'
import { BaseServiceWorkflow } from './base-service-workflow'

export interface RecordIncidentInput {
  id: string
  schoolId: string
  title: string
  description: string
  date: Date
  kind: IncidentKind
  classGroupId?: string
  sessionId?: string
  createdAt?: Date
}

export interface AddStudentInvolvementInput {
  id: string
  incidentId: string
  studentId: string
  role: IncidentInvolvementRole
  notes?: string
  createdAt?: Date
}

export interface ApplyDisciplinaryActionInput {
  id: string
  incidentId: string
  studentId: string
  disciplinaryActionId: string
  startsAt?: Date
  endsAt?: Date
  notes?: string
  createdAt?: Date
}

export interface UpdateStudentDisciplinaryActionStatusInput {
  studentDisciplinaryActionId: string
  status: StudentDisciplinaryActionStatus
  updatedAt?: Date
}

export interface ResolveIncidentInput {
  incidentId: string
  resolutionNotes?: string
  resolvedAt?: Date
}

export class BehaviorServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
  }

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
  }: RecordIncidentInput): Promise<Incident> {
    await requireSchool(this.base.repositories.schools, schoolId)
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
      reporterId: resolveAuditActorId(this.base.actor),
      classGroupId: context.classGroupId,
      sessionId: context.sessionId,
      createdAt,
    })
    await this.base.incidents.save(incident, { moduleChecked: true })
    return incident
  }

  async addStudentInvolvement({
    id,
    incidentId,
    studentId,
    role,
    notes,
    createdAt,
  }: AddStudentInvolvementInput): Promise<StudentIncidentInvolvement> {
    const incident = await this.requireIncident(incidentId)
    await this.authorize('behavior.report_incident', {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      sessionId: incident.sessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const existing = (await this.base.repositories.studentIncidentInvolvements.list({ incidentId, studentId }))[0]
    if (existing) {
      throw new BusinessRuleViolationError('STUDENT_ALREADY_LINKED_TO_INCIDENT', `Student ${studentId} is already linked to incident ${incidentId}`)
    }
    const involvement = new StudentIncidentInvolvement({ id, incidentId, studentId, role, notes, createdAt })
    await this.base.studentIncidentInvolvements.save(involvement, { moduleChecked: true })
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
  }: ApplyDisciplinaryActionInput): Promise<StudentDisciplinaryAction> {
    const incident = await this.requireIncident(incidentId)
    await this.authorize('behavior.manage_discipline', {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      sessionId: incident.sessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const [catalogAction, involvement] = await Promise.all([
      this.base.repositories.disciplinaryActions.findById(disciplinaryActionId),
      this.base.repositories.studentIncidentInvolvements.list({ incidentId, studentId }),
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
      assignedByStaffId: resolveAuditActorId(this.base.actor),
      startsAt,
      endsAt,
      notes,
      createdAt,
    })
    await this.base.studentDisciplinaryActions.save(applied, { moduleChecked: true })
    return applied
  }

  async updateStudentDisciplinaryActionStatus({
    studentDisciplinaryActionId,
    status,
    updatedAt,
  }: UpdateStudentDisciplinaryActionStatusInput): Promise<StudentDisciplinaryAction> {
    const current = await this.base.repositories.studentDisciplinaryActions.findById(studentDisciplinaryActionId)
    if (!current || current.schoolId !== this.base.actor.schoolId) {
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
    await this.base.studentDisciplinaryActions.save(updated, { moduleChecked: true })
    return updated
  }

  async resolveIncident({
    incidentId,
    resolutionNotes,
    resolvedAt,
  }: ResolveIncidentInput): Promise<Incident> {
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
      resolvedByStaffId: resolveAuditActorId(this.base.actor),
      createdAt: current.createdAt,
      updatedAt: resolvedTime,
    })
    await this.base.incidents.save(resolved, { moduleChecked: true })
    return resolved
  }

  private async requireIncident(incidentId: string): Promise<Incident> {
    const incident = await this.base.repositories.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== this.base.actor.schoolId) {
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
      const session = await this.base.repositories.sessions.findById(sessionId)
      const classGroup = session ? await this.base.repositories.classGroups.findById(session.classGroupId) : undefined
      if (!session || !classGroup || classGroup.schoolId !== schoolId || (classGroupId && classGroup.id !== classGroupId)) {
        denyResourceAccess()
      }
      return { classGroupId: classGroup.id, sessionId: session.id }
    }
    if (classGroupId) {
      const classGroup = await this.base.repositories.classGroups.findById(classGroupId)
      if (!classGroup || classGroup.schoolId !== schoolId) {
        denyResourceAccess()
      }
      return { classGroupId: classGroup.id }
    }
    return {}
  }

  private async requireStudentInIncidentScope(studentId: string, incident: Incident): Promise<void> {
    const student = await this.base.repositories.students.findById(studentId)
    if (!student || student.schoolId !== incident.schoolId) {
      denyResourceAccess()
    }
    if (incident.classGroupId) {
      const enrollments = await this.base.repositories.enrollments.list({
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
    if (resource.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    switch (action) {
      case 'behavior.report_incident':
        if (resource.classGroupId) {
          await this.base.authorizationPolicy.checkClassGroupAccess(this.base.actor, [resource.classGroupId])
        }
        else if (resource.sessionId) {
          await this.base.authorizationPolicy.checkSessionAccess(this.base.actor, [resource.sessionId])
        }
        else {
          await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'behavior.report_incident')
        }
        if (resource.studentId) {
          await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [resource.studentId])
        }
        break
      case 'behavior.manage_discipline':
        if (resource.classGroupId) {
          await this.base.authorizationPolicy.checkClassGroupAccess(this.base.actor, [resource.classGroupId])
        }
        else if (resource.sessionId) {
          await this.base.authorizationPolicy.checkSessionAccess(this.base.actor, [resource.sessionId])
        }
        else {
          await this.base.authorizationPolicy.checkGlobalAction(this.base.actor, 'behavior.manage_discipline')
        }
        if (resource.studentId) {
          await this.base.authorizationPolicy.checkStudentAccess(this.base.actor, [resource.studentId])
        }
        break
    }
  }
}

export { DisciplinaryActionKind, StudentDisciplinaryActionStatus }
