import { createSystemActorMetadata } from '@edaya/authorization'
import { AttachmentOwnerKind, AttachmentStatus, MessageDeliveryRecipientKind, MessageDeliveryStatus, TEACHER_PORTRAIT_PURPOSE } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import {
  DEMO_CI_DASHBOARD_ACADEMIC_PERIOD_ID,
  parseSeedDate,
  resolveSeedReferenceDate,
} from '@edaya/fixtures/meta/dates'
import {
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import {
  buildClassStudentIds,
  countGuardians,
  countPublishedPhotosFromPeople,
  countStudents,
} from '@edaya/fixtures/meta/fixture-counts'
import {
  buildSeedValidationTargets,
} from '@edaya/fixtures/meta/validation-harness'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { buildSeedProfileAttachmentId } from '@edaya/fixtures/shared/profile-pictures'
import { createInProcessCommunicationsSeedPort } from '@edaya/seeding'
import { isSeedEntityKey, seedEntityPublicName } from '@edaya/seeding/http'
import { buildSchoolOverview } from '@edaya/service'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, describeWithSeededSchoolData, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchoolData('dev seed contract — dashboard', (getContext) => {
  it('populates executive dashboard KPIs at the narrative reference date', async () => {
    const { application } = getContext()

    const referenceDate = parseSeedDate(resolveSeedReferenceDate())
    const overview = await buildSchoolOverview(application.repositories.dashboardProjections, await application.forActor(createSystemActorMetadata({ systemId: 'fixture-seed', schoolId: SEED_SCHOOL_ID, requestId: 'overview-test', reason: 'Fixture verification' })).baseService.access.overview.scopes(), {
      schoolId: SEED_SCHOOL_ID,
      academicYearId: demoCiDataset.entities.academicYear?.id ?? '',
      academicPeriodId: DEMO_CI_DASHBOARD_ACADEMIC_PERIOD_ID,
      referenceDate,
    })

    expect(overview.kpis.studentCount).toBeGreaterThan(0)
    expect(overview.kpis.staffCount).toBeGreaterThan(0)
    expect(overview.kpis.attendanceRateToday).not.toBeNull()
    expect(overview.kpis.overdueFeeCount).toBeGreaterThan(0)
    expect(overview.kpis.openIncidentCount).toBeGreaterThan(0)
    expect(overview.kpis.pendingJustificationCount).toBeGreaterThan(0)
    // This period's sheets are complete: submission filled missing roster rows
    // with explicit absences. Other periods retain unfinished Draft examples.
    expect(overview.kpis.incompleteGradingClassCount).toBe(0)
    const sheets = await application.repositories.assessments.list()
    expect(new Set(sheets.map(sheet => sheet.marksStatus))).toEqual(new Set(['draft', 'submitted']))
    const corrections = (await Promise.all(sheets.map(sheet => application.repositories.marksCorrections.forAssessment(SEED_SCHOOL_ID, sheet.id)))).flat()
    expect(new Set(corrections.map(row => row.status))).toEqual(new Set(['pending', 'approved', 'rejected']))
    expect(overview.upcoming.length).toBeGreaterThanOrEqual(3)

    const actionKeys = overview.actionItems.map(item => item.key)
    expect(actionKeys).toContain('overdue_fees')
    expect(actionKeys).toContain('pending_justifications')
    expect(actionKeys).toContain('high_severity_incidents')
    expect(actionKeys).not.toContain('incomplete_grading')

    expect(overview.upcoming.some(item => item.kind === 'calendar')).toBe(true)
    expect(overview.upcoming.some(item => item.kind === 'fee_due')).toBe(true)
  })
})

describeWithSeededSchool('dev seed contract', (getContext) => {
  it('lists all seeded entities through staff HTTP routes', async () => {
    const { app, authHeaders } = getContext()
    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)

    const failures: string[] = []
    for (const target of buildSeedValidationTargets()) {
      if (!isSeedEntityKey(target.serviceName)) {
        continue
      }
      if (target.entity === 'profile-photos') {
        const people = await Promise.all((['students', 'staffMembers', 'guardians', 'teachers'] as const).map(async (entityKey) => {
          const response = await app.request(createAppRequest(`/core/entities/${seedEntityPublicName(entityKey)}/list`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ $limit: 500 }),
          }))
          if (response.status !== 200) {
            return []
          }
          return unwrapEntityList(await response.json())
        }))
        const count = countPublishedPhotosFromPeople(people[0], people[1], people[2], people[3])
        if (count < target.minCount) {
          failures.push(`${target.entity}: expected >= ${target.minCount}, got ${count}`)
        }
        continue
      }
      const entityPath = seedEntityPublicName(target.serviceName)
      const response = await app.request(createAppRequest(`/core/entities/${entityPath}/count`, {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      }))
      if (response.status !== 200) {
        failures.push(`${target.entity}: HTTP ${response.status}`)
        continue
      }
      const body = await response.json() as { count?: number }
      const count = body.count ?? 0
      if (count < target.minCount) {
        failures.push(`${target.entity}: expected >= ${target.minCount}, got ${count}`)
      }
    }

    expect(failures).toEqual([])
  })

  it('publishes a downloadable portrait for every seeded teacher', async () => {
    const { application, app, authHeaders } = getContext()
    const headers = await authHeaders()
    for (const teacher of demoCiDataset.entities.teachers ?? []) {
      const attachmentId = buildSeedProfileAttachmentId('teacher', teacher.id)
      const saved = await application.repositories.teachers.findById(teacher.id)
      expect(saved?.photoUrl).toEndWith(`/core/files/${attachmentId}/content`)
      const attachment = await application.repositories.attachments.findById(attachmentId)
      expect(attachment?.data).toMatchObject({
        ownerKind: AttachmentOwnerKind.Teacher,
        ownerId: teacher.id,
        purpose: TEACHER_PORTRAIT_PURPOSE,
        status: AttachmentStatus.Ready,
        mimeType: 'image/jpeg',
      })
      const response = await app.request(createAppRequest(`/core/files/${attachmentId}/download-url`, { headers }))
      expect(response.status).toBe(200)
      const grant = await response.json() as { downloadUrl: string }
      // In-process fixtures issue memory:// grants; the API exposes those bytes at its memory route.
      const storageKey = decodeURIComponent(new URL(grant.downloadUrl).pathname.slice(1))
      expect(attachment?.storageKey).toBe(storageKey)
      const image = await app.request(createAppRequest(`/core/files/memory/${encodeURIComponent(storageKey)}`, { headers }))
      expect(image.status).toBe(200)
      expect(image.headers.get('content-type')).toBe('image/jpeg')
      expect(new Uint8Array(await image.arrayBuffer()).slice(0, 2)).toEqual(new Uint8Array([0xFF, 0xD8]))
    }
  })

  it('seeds minimum-only scales with persistent interval identities', async () => {
    const { application } = getContext()
    const scale = (await application.repositories.gradeScales.findById('ci-gs-20'))!
    expect(scale.intervalConvention).toBe('continuous')
    expect(scale.ranges.map(row => row.id)).toEqual(['ci-gs-20-d', 'ci-gs-20-c', 'ci-gs-20-b', 'ci-gs-20-a'])
    expect(scale.ranges.map(row => row.maxScore)).toEqual([10, 14, 16, 20])
    expect(scale.findRange(9.999)?.letter).toBe('D')
    expect(scale.findRange(10)?.letter).toBe('C')
    expect(scale.findRange(20)?.letter).toBe('A')
  })

  it('configures completed grading before seeding marks and generating report cards', async () => {
    const { application } = getContext()
    for (const fixture of demoCiDataset.extensions?.reportConfigurationFixtures ?? []) {
      const definition = fixture
      const level = (await application.repositories.gradeLevels.findById(definition.gradeLevelId))!
      expect(level.gradingPolicyFor(definition.academicYearId)).toMatchObject({ status: 'completed', mode: 'numeric-first', scale: { id: definition.gradeScaleId } })
    }
    for (const fixture of demoCiDataset.extensions?.reportCardResults ?? []) {
      const report = (await application.repositories.results.findById(fixture.id))!
      if (report.overallAverage !== undefined)
        expect(report.grading).toMatchObject({ maximum: 20, policyRevision: 1, reportedValue: report.overallAverage })
      expect(report.gradingPolicyRevision).toBe(1)
      expect(report.revisedDraft).toBeUndefined()
    }
  })

  it('materializes only linked recipients and preserves explicit inbox history', async () => {
    const { application } = getContext()
    const guardian = await application.repositories.guardians.findById('ci-g1')
    const delivery = await application.repositories.messageDeliveries.findOne({ sourceKey: 'ci-ann-parent-meeting', recipientId: 'ci-g1' })
    expect(guardian?.subjectId).toBeTruthy()
    expect(delivery?.subjectId).toBe(guardian!.subjectId)
    expect(delivery?.recipientId).toBe('ci-g1')
    expect(delivery?.status).toBe(MessageDeliveryStatus.Read)
    expect(delivery?.readAt).toBeTruthy()
    const beforeCount = await application.repositories.messageDeliveries.count()
    await createInProcessCommunicationsSeedPort(application).recordDelivery({
      id: 'duplicate-seed-id',
      schoolId: SEED_SCHOOL_ID,
      announcementId: 'ci-ann-parent-meeting',
      subjectId: guardian!.subjectId!,
      recipientKind: MessageDeliveryRecipientKind.Guardian,
      recipientId: 'ci-g1',
      title: delivery!.title,
      body: delivery!.body,
      status: MessageDeliveryStatus.Sent,
      sentAt: '2026-01-28T18:05:00.000Z',
    })
    expect(await application.repositories.messageDeliveries.count()).toBe(beforeCount)
    const retained = await application.repositories.messageDeliveries.findById(delivery!.id)
    expect(retained?.data).toEqual(delivery!.data)
    expect(retained?.status).toBe(MessageDeliveryStatus.Read)
    expect(retained?.readAt).toEqual(delivery!.readAt)
    expect(await application.repositories.messageDeliveries.findById('duplicate-seed-id')).toBeUndefined()
    expect(await application.repositories.messageDeliveries.findById('ci-md-staff-read')).toBeUndefined()
    const deliveries = await application.repositories.messageDeliveries.list()
    expect(deliveries.some(record => record.announcementId === 'ci-ann-rentree' && record.recipientId === 'ci-g1')).toBe(true)
    expect(deliveries.some(record => record.recipientKind === MessageDeliveryRecipientKind.Student)).toBe(false)
  })

  it('lets seeded non-owner staff list students after permission assignments are provisioned', async () => {
    const { app, authHeaders } = getContext()
    const response = await app.request(createAppRequest('/core/entities/students/list', {
      method: 'POST',
      headers: await authHeaders(DEV_AUTH_STAFF_ACCOUNTS[1].email),
      body: JSON.stringify({}),
    }))

    expect(response.status).toBe(200)
  })

  it('seeds population targets with class distribution and staff assignments', async () => {
    const { app, seedResult, authHeaders } = getContext()
    expect(seedResult.students).toBe(countStudents(demoCiDataset))
    expect(seedResult.guardians).toBe(countGuardians(demoCiDataset))

    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)
    const [studentsCountResponse, guardiansCountResponse, enrollmentsCountResponse, staffAssignmentsResponse, studentsResponse, guardiansResponse] = await Promise.all([
      app.request(createAppRequest('/core/entities/students/count', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/guardians/count', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/enrollments/count', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/staff-assignments/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      })),
      app.request(createAppRequest('/core/entities/students/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({ $limit: 500 }),
      })),
      app.request(createAppRequest('/core/entities/guardians/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({ $limit: countGuardians(demoCiDataset) }),
      })),
    ])

    expect(studentsCountResponse.status).toBe(200)
    expect(guardiansCountResponse.status).toBe(200)
    expect(enrollmentsCountResponse.status).toBe(200)
    expect(staffAssignmentsResponse.status).toBe(200)
    expect(studentsResponse.status).toBe(200)
    expect(guardiansResponse.status).toBe(200)

    const studentsCount = (await studentsCountResponse.json() as { count?: number }).count ?? 0
    const guardiansCount = (await guardiansCountResponse.json() as { count?: number }).count ?? 0
    const enrollmentsCount = (await enrollmentsCountResponse.json() as { count?: number }).count ?? 0
    const students = unwrapEntityList<{ id: string }>(await studentsResponse.json())
    const guardians = unwrapEntityList<{ id: string }>(await guardiansResponse.json())
    const staffAssignments = unwrapEntityList<{ id: string, classGroupId?: string }>(
      await staffAssignmentsResponse.json(),
    )

    expect(studentsCount).toBe(countStudents(demoCiDataset))
    expect(guardiansCount).toBeGreaterThanOrEqual(countGuardians(demoCiDataset))
    expect(enrollmentsCount).toBe(countStudents(demoCiDataset))
    expect(students.some(student => student.id === 'ci-s30')).toBe(true)
    expect(guardians.some(guardian => guardian.id === 'ci-g9')).toBe(true)

    for (const [classGroupId, studentIds] of Object.entries(buildClassStudentIds(demoCiDataset))) {
      for (const studentId of studentIds) {
        const enrollmentResponse = await app.request(createAppRequest('/core/entities/enrollments/one', {
          method: 'POST',
          headers,
          body: JSON.stringify({ studentId, classGroupId }),
        }))
        expect(enrollmentResponse.status).toBe(200)
      }
    }

    expect(staffAssignments.some(assignment => assignment.id === 'sa-ci-st3-6a' && assignment.classGroupId === 'ci-6a')).toBe(true)
    expect(staffAssignments.some(assignment => assignment.id === 'sa-ci-st3-5a' && assignment.classGroupId === 'ci-5a')).toBe(true)
  })
})
