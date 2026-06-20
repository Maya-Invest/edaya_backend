import {
  countSeedAnnouncements,
  countSeedAnnouncementTargets,
  countSeedAttachments,
  countSeedDisciplinaryActions,
  countSeedMessageDeliveriesMinimum,
  countSeedStudentDisciplinaryActions,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/dev-fixtures'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev communications discipline attachments seed', (getContext) => {
  it('seeds announcements, discipline catalog, attachments and lets staff list entities', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.announcements).toBe(countSeedAnnouncements())
    expect(seedResult.announcementTargets).toBe(countSeedAnnouncementTargets())
    expect(seedResult.messageDeliveries).toBeGreaterThanOrEqual(countSeedMessageDeliveriesMinimum())
    expect(seedResult.disciplinaryActions).toBe(countSeedDisciplinaryActions())
    expect(seedResult.studentDisciplinaryActions).toBe(countSeedStudentDisciplinaryActions())
    expect(seedResult.attachments).toBe(countSeedAttachments())

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [
      announcementsResponse,
      deliveriesResponse,
      disciplinaryActionsResponse,
      studentDisciplinaryActionsResponse,
      attachmentsResponse,
    ] = await Promise.all([
      app.request(createAppRequest('/core/entities/announcements/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/message-deliveries/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/disciplinary-actions/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/student-disciplinary-actions/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/attachments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
    ])

    expect(announcementsResponse.status).toBe(200)
    expect(deliveriesResponse.status).toBe(200)
    expect(disciplinaryActionsResponse.status).toBe(200)
    expect(studentDisciplinaryActionsResponse.status).toBe(200)
    expect(attachmentsResponse.status).toBe(200)

    const announcements = unwrapEntityList<{ id: string, title: string, status: string }>(await announcementsResponse.json())
    const deliveries = unwrapEntityList<{ id: string, announcementId: string, status: string }>(await deliveriesResponse.json())
    const disciplinaryActions = unwrapEntityList<{ id: string, name: string, kind: string }>(await disciplinaryActionsResponse.json())
    const studentDisciplinaryActions = unwrapEntityList<{ id: string, incidentId: string, status: string }>(await studentDisciplinaryActionsResponse.json())
    const attachments = unwrapEntityList<{ id: string, ownerKind: string, fileName: string }>(await attachmentsResponse.json())

    expect(announcements.length).toBeGreaterThanOrEqual(countSeedAnnouncements())
    expect(deliveries.length).toBeGreaterThanOrEqual(countSeedMessageDeliveriesMinimum())
    expect(disciplinaryActions.length).toBeGreaterThanOrEqual(countSeedDisciplinaryActions())
    expect(studentDisciplinaryActions.length).toBeGreaterThanOrEqual(countSeedStudentDisciplinaryActions())
    expect(attachments.length).toBeGreaterThanOrEqual(countSeedAttachments())

    expect(announcements.some(entry => entry.id === 'ann-rentree' && entry.status === 'published')).toBe(true)
    expect(announcements.some(entry => entry.id === 'ann-draft-fete' && entry.status === 'draft')).toBe(true)
    expect(deliveries.some(entry => entry.id === 'md-parent-g1-read' && entry.status === 'read')).toBe(true)
    expect(disciplinaryActions.some(entry => entry.id === 'da-detention' && entry.kind === 'sanction')).toBe(true)
    expect(studentDisciplinaryActions.some(entry => entry.id === 'sda-i2-s2' && entry.status === 'completed')).toBe(true)
    expect(attachments.some(entry => entry.id === 'att-hp-s3-plan' && entry.fileName === 'peanut_allergy_plan.pdf')).toBe(true)
  })
})
