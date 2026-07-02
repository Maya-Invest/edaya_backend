import { buildSchoolOverview } from '@edaya/core'
import { devSeedDataset } from '@edaya/fixtures'
import {
  parseSeedDate,
  resolveSeedReferenceDate,
  SEED_DASHBOARD_ACADEMIC_PERIOD_ID,
} from '@edaya/fixtures/meta/dates'
import {
  DEV_AUTH_STAFF_ACCOUNTS,
  MINIMAL_AUTH_FIXTURE_STAFF_EMAIL,
} from '@edaya/fixtures/meta/dev-auth-fixtures'
import {
  buildClassStudentIds,
  countGuardians,
  countStudents,
} from '@edaya/fixtures/meta/fixture-counts'
import {
  buildSeedValidationTargets,
} from '@edaya/fixtures/meta/validation-harness'
import { SEED_SCHOOL_ID } from '@edaya/fixtures/shared/ids'
import { isSeedEntityKey, seedEntityPublicName } from '@edaya/seeding/http'
import { expect, it } from 'bun:test'
import { createAppRequest } from '../support/api-route-harness'
import { describeWithSeededSchool, describeWithSeededSchoolData, unwrapEntityList } from '../support/seeded-route-test-context'

describeWithSeededSchool('dev seed contract', (getContext) => {
  it('lists all seeded entities through staff HTTP routes', async () => {
    const { app, authHeaders } = getContext()
    const headers = await authHeaders(MINIMAL_AUTH_FIXTURE_STAFF_EMAIL)

    const failures: string[] = []
    for (const target of buildSeedValidationTargets()) {
      if (!isSeedEntityKey(target.serviceName)) {
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

  it('lets seeded teachers list students after access roles are provisioned', async () => {
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
    expect(seedResult.students).toBe(countStudents(devSeedDataset))
    expect(seedResult.guardians).toBe(countGuardians(devSeedDataset))

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
        body: JSON.stringify({ $limit: countGuardians(devSeedDataset) }),
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

    expect(studentsCount).toBe(countStudents(devSeedDataset))
    expect(guardiansCount).toBeGreaterThanOrEqual(countGuardians(devSeedDataset))
    expect(enrollmentsCount).toBe(countStudents(devSeedDataset))
    expect(students.some(student => student.id === 's30')).toBe(true)
    expect(guardians.some(guardian => guardian.id === 'g9')).toBe(true)

    for (const [classGroupId, studentIds] of Object.entries(buildClassStudentIds(devSeedDataset))) {
      for (const studentId of studentIds) {
        const enrollmentResponse = await app.request(createAppRequest('/core/entities/enrollments/one', {
          method: 'POST',
          headers,
          body: JSON.stringify({ studentId, classGroupId }),
        }))
        expect(enrollmentResponse.status).toBe(200)
      }
    }

    expect(staffAssignments.some(assignment => assignment.id === 'sa-st2-6b' && assignment.classGroupId === '6b')).toBe(true)
    expect(staffAssignments.some(assignment => assignment.id === 'sa-st3-5a' && assignment.classGroupId === '5a')).toBe(true)
  })
})

describeWithSeededSchoolData('dev seed contract — dashboard', (getContext) => {
  it('populates executive dashboard KPIs at the narrative reference date', async () => {
    const { application } = getContext()

    const referenceDate = parseSeedDate(resolveSeedReferenceDate())
    const overview = await buildSchoolOverview(application.repositories, {
      schoolId: SEED_SCHOOL_ID,
      academicYearId: devSeedDataset.entities.academicYear?.id ?? '',
      academicPeriodId: SEED_DASHBOARD_ACADEMIC_PERIOD_ID,
      referenceDate,
    })

    expect(overview.kpis.studentCount).toBeGreaterThan(0)
    expect(overview.kpis.staffCount).toBeGreaterThan(0)
    expect(overview.kpis.attendanceRateToday).not.toBeNull()
    expect(overview.kpis.overdueFeeCount).toBeGreaterThan(0)
    expect(overview.kpis.openIncidentCount).toBeGreaterThan(0)
    expect(overview.kpis.pendingJustificationCount).toBeGreaterThan(0)
    expect(overview.kpis.incompleteGradingClassCount).toBeGreaterThan(0)
    expect(overview.upcoming.length).toBeGreaterThanOrEqual(3)

    const actionKeys = overview.actionItems.map(item => item.key)
    expect(actionKeys).toContain('overdue_fees')
    expect(actionKeys).toContain('pending_justifications')
    expect(actionKeys).toContain('high_severity_incidents')
    expect(actionKeys).toContain('incomplete_grading')

    expect(overview.upcoming.some(item => item.kind === 'calendar')).toBe(true)
    expect(overview.upcoming.some(item => item.kind === 'fee_due')).toBe(true)
  })
})
