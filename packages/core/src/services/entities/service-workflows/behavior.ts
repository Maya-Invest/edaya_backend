import type { Incident } from '../../../entities/students/incident'
import type { IncidentInvolvementRole } from '../../../entities/students/student-incident-involvement'
import type { BaseSchoolService } from '../base-school-service'
import { DisciplinaryActionKind } from '../../../entities/students/disciplinary-action'
import { StudentClassEnrollmentStatus } from '../../../entities/students/student-class-enrollment'
import { StudentDisciplinaryAction, StudentDisciplinaryActionStatus } from '../../../entities/students/student-disciplinary-action'
import { StudentIncidentInvolvement } from '../../../entities/students/student-incident-involvement'
import { denyResourceAccess, resolveAuditActorId } from '../../authorization'
import { BusinessRuleViolationError } from '../../shared/business-rule-error'
import { BaseServiceWorkflow } from './base-service-workflow'

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

export class BehaviorServiceWorkflow extends BaseServiceWorkflow {
  constructor(base: BaseSchoolService) {
    super(base)
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

  private async requireIncident(incidentId: string): Promise<Incident> {
    const incident = await this.base.repositories.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== this.base.actor.schoolId) {
      denyResourceAccess()
    }
    return incident
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
