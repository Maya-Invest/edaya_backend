import type { AuthorizationPolicy } from '../../../src/capabilities/authorization'
import type { SchoolRepositories } from '../../../src/ports'
import { describe, expect, mock, test } from 'bun:test'
import { noOpNotificationGateway, SchoolService } from '../../../src'
import { AuthorizationError } from '../../../src/capabilities/authorization'
import { createElevatedTestStaffActor } from '../../support/elevated-test-actor'
import { testFileStorage } from '../../support/test-file-storage'

describe('SchoolService query operations', () => {
  const mockRepos = {
    schools: {
      getOverdueFeeCount: mock(async () => 5),
      getPublishedReportCardCount: mock(async () => 10),
      getSchoolOverview: mock(async () => ({
        schoolId: 'school1',
        academicYearId: 'year1',
        academicPeriodId: 'period1',
        referenceDate: '2026-06-14',
        kpis: {
          studentCount: 100,
          staffCount: 12,
          overdueFeeCount: 5,
          overdueFeeAmount: 5000,
          publishedReportCardCount: 10,
          unpublishedReportCardCount: 90,
          attendanceRateToday: 95,
          absencesToday: 2,
          openIncidentCount: 1,
          highSeverityIncidentCount: 0,
          pendingJustificationCount: 3,
          incompleteGradingClassCount: 2,
        },
        actionItems: [],
        upcoming: [],
      })),
    },
  } as unknown as SchoolRepositories

  const mockPolicy = {
  } as unknown as AuthorizationPolicy

  const actor = createElevatedTestStaffActor('school1', 'staff-test')
  const mockAtomic = { execute: mock(async (op: () => Promise<any>) => op()) }

  const service = new SchoolService({
    repositories: mockRepos,
    authorizationPolicy: mockPolicy,
    actor,
    atomicExecution: mockAtomic,
    notificationGateway: noOpNotificationGateway,
    fileStorage: testFileStorage,
  })

  test('getOverdueFeeCount checks permission and delegates to repo', async () => {
    const result = await service.getOverdueFeeCount('school1')
    expect(mockRepos.schools.getOverdueFeeCount).toHaveBeenCalledWith('school1')
    expect(result).toBe(5)
  })

  test('getPublishedReportCardCount checks permission and delegates to repo', async () => {
    const result = await service.getPublishedReportCardCount('school1')
    expect(mockRepos.schools.getPublishedReportCardCount).toHaveBeenCalledWith('school1')
    expect(result).toBe(10)
  })

  test('aggregate queries reject cross-tenant school ids before repository access', async () => {
    await expect(service.getOverdueFeeCount('other-school')).rejects.toBeInstanceOf(AuthorizationError)
    await expect(service.getSchoolOverview({
      schoolId: 'other-school',
      academicYearId: 'year1',
      academicPeriodId: 'period1',
    })).rejects.toBeInstanceOf(AuthorizationError)
  })

  test('getSchoolOverview checks permission and delegates to repo', async () => {
    const input = {
      schoolId: 'school1',
      academicYearId: 'year1',
      academicPeriodId: 'period1',
    }
    const result = await service.getSchoolOverview(input)
    expect(mockRepos.schools.getSchoolOverview).toHaveBeenCalledWith(input)
    expect(result.kpis.studentCount).toBe(100)
  })

  test('getClassGroupTimetable checks access and builds timetable', async () => {
    const mockClassGroups = {
      findById: mock(async () => ({ id: 'cg1', schoolId: 'school1' })),
    }
    const mockLessonSessions = {
      list: mock(async () => []),
    }
    const mockActivitySessions = {
      list: mock(async () => []),
    }
    const mockAssessments = {
      list: mock(async () => []),
    }
    const mockPolicyWithClassGroup = {
      checkClassGroupAccess: mock(async () => {}),
    } as unknown as AuthorizationPolicy

    const timetableService = new SchoolService({
      repositories: {
        ...mockRepos,
        classGroups: mockClassGroups,
        lessonSessions: mockLessonSessions,
        activitySessions: mockActivitySessions,
        assessments: mockAssessments,
      } as unknown as SchoolRepositories,
      authorizationPolicy: mockPolicyWithClassGroup,
      actor,
      atomicExecution: mockAtomic,
      notificationGateway: noOpNotificationGateway,
      fileStorage: testFileStorage,
    })

    const input = {
      classGroupId: 'cg1',
      startDate: new Date('2026-05-01T00:00:00.000Z'),
      endDate: new Date('2026-05-31T00:00:00.000Z'),
    }
    const result = await timetableService.getClassGroupTimetable(input)
    expect(mockPolicyWithClassGroup.checkClassGroupAccess).toHaveBeenCalledWith(actor, ['cg1'])
    expect(result.classGroupId).toBe('cg1')
    expect(result.events).toEqual([])
  })
})
