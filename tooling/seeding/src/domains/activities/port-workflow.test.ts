import type { FixtureDataset } from '@edaya/fixtures'
import type {
  ActivitiesSeedPort,
  ActivityEnrollmentSeedRecord,
  ActivitySeedRecord,
} from './port'
import { ActivityCategory, ActivityEnrollmentStatus } from '@edaya/core'
import { demoCiDataset } from '@edaya/fixtures'
import { describe, expect, test } from 'bun:test'
import { seedDevActivities } from './workflow'

describe('activities seed port workflow', () => {
  test('seeds activities and enrollments with explicit domain enums', async () => {
    const activities: ActivitySeedRecord[] = []
    const enrollments: ActivityEnrollmentSeedRecord[] = []
    const port: ActivitiesSeedPort = {
      saveActivity: async (record) => {
        activities.push(record)
      },
      saveEnrollment: async (record) => {
        enrollments.push(record)
      },
      saveClassActivityEnrollment: async () => {},
    }

    const counts = await seedDevActivities(port, demoCiDataset)

    expect(counts).toEqual({
      activities: demoCiDataset.entities.activities?.length ?? 0,
      activityEnrollments: demoCiDataset.entities.activityEnrollments?.length ?? 0,
      classActivityEnrollments: (demoCiDataset.entities as FixtureDataset['entities']).classActivityEnrollments?.length ?? 0,
    })
    expect(activities.map(record => record.category)).toContain(ActivityCategory.Science)
    expect(activities[0]?.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T12:00:00\.000Z$/)
    expect(enrollments.map(record => record.status)).toContain(ActivityEnrollmentStatus.Pending)
  })
})
