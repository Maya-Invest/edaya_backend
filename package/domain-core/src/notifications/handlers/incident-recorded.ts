import type { Guardian, Incident, StudentIncidentInvolvement } from '../../domains'
import type { WorkflowNotificationContext } from '../workflow-notification-runner'
import { MessageDeliveryRecipientKind } from '../../domains'
import { deliverNotification } from '../deliver-notification'
import { uniqueNotificationRecipients } from '../recipient-utils'
import { renderNotificationEnqueueContent } from '../templates/render-enqueue-content'
import { resolveSchoolName } from '../templates/resolve-school-name'

export const INCIDENT_RECORDED_EVENT_KEY = 'incident.recorded'

export interface IncidentRecordedPayload {
  incident: Incident
  involvement: StudentIncidentInvolvement
}

export async function handleIncidentRecorded(
  context: WorkflowNotificationContext,
  payload: IncidentRecordedPayload,
): Promise<void> {
  const { incident, involvement } = payload
  if (incident.schoolId !== context.actor.schoolId) {
    return
  }

  const recipients = await resolveInvolvedGuardianRecipients(
    context,
    involvement.studentId,
    incident.schoolId,
  )
  if (recipients.length === 0) {
    return
  }

  const schoolName = await resolveSchoolName(context.repositories, incident.schoolId)
  const content = await renderNotificationEnqueueContent(context.templateService, {
    schoolId: incident.schoolId,
    templateKey: INCIDENT_RECORDED_EVENT_KEY,
    variables: {
      schoolName,
      incidentTitle: incident.title,
      incidentDescription: incident.description,
    },
  })

  await deliverNotification({
    notificationGateway: context.notificationGateway,
    repositories: context.repositories,
  }, {
    schoolId: incident.schoolId,
    kind: 'event',
    eventKey: INCIDENT_RECORDED_EVENT_KEY,
    idempotencyKeyPrefix: `${INCIDENT_RECORDED_EVENT_KEY}:${incident.id}:${involvement.studentId}`,
    ...content,
    recipients: uniqueNotificationRecipients(recipients),
    metadata: {
      incidentId: incident.id,
      studentId: involvement.studentId,
      involvementRole: involvement.role,
      incidentKind: incident.kind,
    },
  })
}

async function resolveInvolvedGuardianRecipients(
  context: WorkflowNotificationContext,
  studentId: string,
  schoolId: string,
) {
  const links = await context.repositories.guardianLinks.list({ studentId })
  const recipients: Array<{ kind: MessageDeliveryRecipientKind, id: string }> = []

  for (const link of links) {
    const guardian = await context.repositories.guardians.findById(link.guardianId)
    if (!guardian || guardian.schoolId !== schoolId || !guardianAllowsNotifications(guardian)) {
      continue
    }
    recipients.push({
      kind: MessageDeliveryRecipientKind.Guardian,
      id: guardian.id,
    })
  }

  return recipients
}

function guardianAllowsNotifications(guardian: Guardian): boolean {
  if (guardian.contactMethods.length === 0) {
    return true
  }
  return guardian.contactMethods.some(method => method.allowsNotifications)
}
