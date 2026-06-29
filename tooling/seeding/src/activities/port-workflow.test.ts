import type {
  ActivitiesSeedPort,
  ActivityEnrollmentSeedRecord,
  ExtracurricularActivitySeedRecord,
} from './port'
import { ActivityEnrollmentStatus, ExtracurricularActivityCategory } from '@edaya/core'
import { SEED_ACTIVITY_ENROLLMENTS, SEED_EXTRACURRICULAR_ACTIVITIES } from '@edaya/dev-fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevActivities } from './workflow'

describe('activities seed port workflow', () => {
  test('seeds activities and enrollments with explicit domain enums', async () => {
    const activities: ExtracurricularActivitySeedRecord[] = []
    const enrollments: ActivityEnrollmentSeedRecord[] = []
    const port: ActivitiesSeedPort = {
      saveActivity: async (record) => {
        activities.push(record)
      },
      saveEnrollment: async (record) => {
        enrollments.push(record)
      },
    }

    const counts = await seedDevActivities(port)

    expect(counts).toEqual({
      activities: SEED_EXTRACURRICULAR_ACTIVITIES.length,
      activityEnrollments: SEED_ACTIVITY_ENROLLMENTS.length,
    })
    expect(activities.map(record => record.category)).toContain(ExtracurricularActivityCategory.Science)
    expect(activities[0]?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(enrollments.map(record => record.status)).toContain(ActivityEnrollmentStatus.Pending)
  })
})
