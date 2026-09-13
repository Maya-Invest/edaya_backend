import type { AccessPolicies } from './access-policies'
import { Permission } from '@edaya/core'
import { AccessFacts } from './facts'

/** Incident and participant authority always belong to the same business action. */
export class DisciplineAccessPolicy {
  constructor(private readonly access: AccessPolicies) {}

  assertAddInvolvement(input: { incidentId: string, studentId: string }) {
    return this.assertParticipant(Permission.DISCIPLINE_CREATE, input)
  }

  assertApplySanction(input: { incidentId: string, studentId: string }) {
    return this.assertParticipant(Permission.DISCIPLINE_VALIDATE, input)
  }

  async resolutionContext(incidentId: string, proposedStudentIds: readonly string[] = []) {
    await this.access.assertResources(Permission.DISCIPLINE_VALIDATE, 'incidents', [incidentId])
    const facts = new AccessFacts(this.access.actor, this.access.repositories)
    const incident = await facts.one('incidents', incidentId)
    const existing = await facts.list('studentIncidentInvolvements', { incidentId })
    const students = [...new Set([...proposedStudentIds, ...existing.map(row => row.studentId)])]
    if (students.length)
      await this.access.assertResources(Permission.DISCIPLINE_VALIDATE, 'students', students)
    return incident
  }

  private async assertParticipant(action: Permission, input: { incidentId: string, studentId: string }) {
    await this.access.assertResources(action, 'incidents', [input.incidentId])
    await this.access.assertResources(action, 'students', [input.studentId])
  }
}
