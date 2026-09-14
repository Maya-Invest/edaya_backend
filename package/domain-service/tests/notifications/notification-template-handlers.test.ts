import { AcademicPeriod, Announcement, AnnouncementPriority, AnnouncementTarget, AnnouncementTargetKind, ClassGroup, GuardianStudentLink, IncidentInvolvementRole, IncidentKind, MessageDeliveryRecipientKind, RecordingNotificationGateway, SchoolNotificationTemplates, Student, Subject } from '@edaya/core'
import { describe, expect, test } from 'bun:test'
import { ANNOUNCEMENT_PUBLISHED_EVENT_KEY, ASSESSMENT_RESULT_RECORDED_EVENT_KEY, INCIDENT_RECORDED_EVENT_KEY, REPORT_CARD_PUBLISHED_EVENT_KEY } from '../../src/capabilities/notifications'
import { buildDefaultNotificationTemplateDocument } from '../../src/capabilities/notifications/templates/defaults/manifest'
import { createReportCardContext } from '../services/workflows/report-card-workflow-context'

async function createContext() {
  const gateway = new RecordingNotificationGateway()
  const fixture = await createReportCardContext({ notificationGateway: gateway })
  const r = fixture.repositories
  const student = (await r.students.findById('stu1'))!
  await r.students.save(new Student({ ...student.data, firstName: 'Noah', lastName: 'Martin' }))
  const group = (await r.classGroups.findById('cg1'))!
  await r.classGroups.save(new ClassGroup({ ...group.data, name: '6ème A' }))
  const period = (await r.academicPeriods.findById('per1'))!
  await r.academicPeriods.save(new AcademicPeriod({ ...period.data, name: 'Term 2' }))
  const subject = (await r.subjects.findById('subject-math'))!
  await r.subjects.save(new Subject({ ...subject.data, name: 'Mathematics' }))
  await r.schoolNotificationTemplates.save(new SchoolNotificationTemplates({ schoolId: 'sch1', ...await buildDefaultNotificationTemplateDocument() }))
  return { ...fixture, gateway }
}

describe('templated notifications through authorized workflows', () => {
  test('incident notifications use a saved school template document', async () => {
    const { service, repositories, gateway } = await createContext()
    const templates = await buildDefaultNotificationTemplateDocument()
    await repositories.schoolNotificationTemplates.save(new SchoolNotificationTemplates({
      schoolId: 'sch1',
      ...templates,
      incidentRecorded: {
        ...templates.incidentRecorded,
        base_message: { title: 'In-app: {{incidentTitle}}', body: 'In-app body for {{incidentTitle}}' },
        rich_message: { subject: 'Email: {{incidentTitle}}', body: '<p>Email body for {{incidentTitle}}</p>' },
      },
    }))
    await service.behaviorWorkflow.recordIncident({ id: 'inc1', schoolId: 'sch1', title: 'Hall incident', description: 'Incident description', date: new Date('2026-05-01'), kind: IncidentKind.MinorInfraction, classGroupId: 'cg1' })
    await service.behaviorWorkflow.addStudentInvolvement({ id: 'inv1', incidentId: 'inc1', studentId: 'stu1', role: IncidentInvolvementRole.Subject })
    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({ eventKey: INCIDENT_RECORDED_EVENT_KEY, title: 'In-app: Hall incident', body: 'In-app body for Hall incident', emailSubject: 'Email: Hall incident', emailBody: '<p>Email body for Hall incident</p>' })
  })

  test('announcement publication enqueues one notification per materialized profile delivery', async () => {
    const { service, repositories, gateway } = await createContext()
    await repositories.announcements.save(new Announcement({ id: 'ann1', schoolId: 'sch1', title: 'School closure', content: 'School closed tomorrow due to weather.', priority: AnnouncementPriority.Important }))
    await repositories.announcementTargets.save(new AnnouncementTarget({ id: 'target', announcementId: 'ann1', targetKind: AnnouncementTargetKind.Guardian, targetId: 'gua1' }))
    await service.communicationsWorkflow.publishAnnouncement({ announcementId: 'ann1' })
    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]).toMatchObject({ eventKey: ANNOUNCEMENT_PUBLISHED_EVENT_KEY, announcementId: 'ann1', priority: AnnouncementPriority.Important })
    expect(gateway.enqueued[0]?.body).toContain('School closed tomorrow')
  })

  test('report-card notifications include period and class context', async () => {
    const { service, gateway } = await createContext()
    await service.assessmentsWorkflow.publishReportCardResult({ id: 'rc1', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: 'def1' })
    expect(gateway.enqueued).toHaveLength(2)
    expect(gateway.enqueued[0]).toMatchObject({ eventKey: REPORT_CARD_PUBLISHED_EVENT_KEY })
    expect(gateway.enqueued[0]?.body).toContain('Term 2')
    expect(gateway.enqueued[0]?.body).toContain('6ème A')
  })

  test('assessment-result notifications render score context for guardians', async () => {
    const { service, repositories, gateway } = await createContext()
    await repositories.assessmentResults.delete('ar1')
    await service.assessmentsWorkflow.recordAssessmentResult({ id: 'res1', studentId: 'stu1', assessmentId: 'ass1', score: 18 })
    expect(gateway.enqueued).toHaveLength(2)
    expect(gateway.enqueued[0]).toMatchObject({ eventKey: ASSESSMENT_RESULT_RECORDED_EVENT_KEY })
    expect(gateway.enqueued[0]?.body).toContain('Mathematics')
    expect(gateway.enqueued[0]?.body).toContain('18')
  })

  test('persisted academic-report opt-out suppresses guardian notifications', async () => {
    const { service, repositories, gateway } = await createContext()
    const link = (await repositories.guardianLinks.findById('link'))!
    await repositories.guardianLinks.save(new GuardianStudentLink({ ...link.data, receivesAcademicReports: false }))
    await service.assessmentsWorkflow.publishReportCardResult({ id: 'rc1', studentId: 'stu1', periodId: 'per1', reportCardDefinitionId: 'def1' })
    expect(gateway.enqueued).toHaveLength(1)
    expect(gateway.enqueued[0]?.recipients).toEqual([{ kind: MessageDeliveryRecipientKind.Student, id: 'stu1', subjectId: 'subject-stu1' }])
    expect(await repositories.messageDeliveries.count({ recipientKind: MessageDeliveryRecipientKind.Guardian })).toBe(0)
  })
})
