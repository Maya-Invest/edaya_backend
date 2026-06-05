import type { Incident } from '../../entities/students/incident'
import type { IncidentInvolvementRole } from '../../entities/students/student-incident-involvement'
import type { BaseSchoolService } from '../base-school-service'
import { denyResourceAccess, Permission, resolveAuditActorId } from '../../authorization'
import { DisciplinaryActionKind } from '../../entities/students/disciplinary-action'
import { StudentClassEnrollmentStatus } from '../../entities/students/student-class-enrollment'
import { StudentDisciplinaryAction, StudentDisciplinaryActionStatus } from '../../entities/students/student-disciplinary-action'
import { StudentIncidentInvolvement } from '../../entities/students/student-incident-involvement'
import { permissionAction } from '../../shared'
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
    await this.authorize(Permission.DISCIPLINE_CREATE, {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      sessionId: incident.sessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const existing = (await this.baseService.repositories.studentIncidentInvolvements.list({ incidentId, studentId }))[0]
    if (existing) {
      throw new BusinessRuleViolationError('STUDENT_ALREADY_LINKED_TO_INCIDENT', `Student ${studentId} is already linked to incident ${incidentId}`)
    }
    const involvement = new StudentIncidentInvolvement({ id, incidentId, studentId, role, notes, createdAt })
    await this.baseService.studentIncidentInvolvements.save(involvement, { moduleChecked: true })
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
    await this.authorize(Permission.DISCIPLINE_VALIDATE, {
      schoolId: incident.schoolId,
      classGroupId: incident.classGroupId,
      sessionId: incident.sessionId,
      studentId,
    })
    await this.requireStudentInIncidentScope(studentId, incident)
    const [catalogAction, involvement] = await Promise.all([
      this.baseService.repositories.disciplinaryActions.findById(disciplinaryActionId),
      this.baseService.repositories.studentIncidentInvolvements.list({ incidentId, studentId }),
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
      assignedByStaffId: resolveAuditActorId(this.baseService.actor),
      startsAt,
      endsAt,
      notes,
      createdAt,
    })
    await this.baseService.studentDisciplinaryActions.save(applied, { moduleChecked: true })
    return applied
  }

  private async requireIncident(incidentId: string): Promise<Incident> {
    const incident = await this.baseService.repositories.incidents.findById(incidentId)
    if (!incident || incident.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }
    return incident
  }

  private async requireStudentInIncidentScope(studentId: string, incident: Incident): Promise<void> {
    const student = await this.baseService.repositories.students.findById(studentId)
    if (!student || student.schoolId !== incident.schoolId) {
      denyResourceAccess()
    }
    if (incident.classGroupId) {
      const enrollments = await this.baseService.repositories.enrollments.list({
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
    permission: Permission.DISCIPLINE_CREATE | Permission.DISCIPLINE_VALIDATE,
    resource: {
      schoolId: string
      classGroupId?: string
      sessionId?: string
      studentId?: string
    },
  ): Promise<void> {
    if (resource.schoolId !== this.baseService.actor.schoolId) {
      denyResourceAccess()
    }

    await permissionAction(this.baseService.authorizationPolicy, permission)(this.baseService.actor)

    if (resource.classGroupId) {
      await this.baseService.authorizationPolicy.checkClassGroupAccess(this.baseService.actor, [resource.classGroupId])
    }
    else if (resource.sessionId) {
      await this.baseService.authorizationPolicy.checkSessionAccess(this.baseService.actor, [resource.sessionId])
    }
    if (resource.studentId) {
      await this.baseService.authorizationPolicy.checkStudentAccess(this.baseService.actor, [resource.studentId])
    }
  }
}

export { DisciplinaryActionKind, StudentDisciplinaryActionStatus }
