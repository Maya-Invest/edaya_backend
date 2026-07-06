import type { ActivityEnrollmentInput, ActivityInput } from '@edaya/core'
import type { FixtureDataset } from '@edaya/fixtures'
import type { ActivitiesSeedPort } from './port'

function isoDateTime(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString()
  }
  return String(value)
}

function activitySeedRecord(activity: ActivityInput) {
  return {
    id: activity.id,
    schoolId: activity.schoolId,
    name: activity.name,
    category: activity.category,
    coach: activity.coach,
    schedule: activity.schedule,
    participants: activity.participants,
    capacity: activity.capacity,
    description: activity.description,
    startDate: isoDateTime(activity.startDate),
    endDate: isoDateTime(activity.endDate),
  }
}

function enrollmentSeedRecord(enrollment: ActivityEnrollmentInput) {
  return {
    id: enrollment.id,
    activityId: enrollment.activityId,
    studentId: enrollment.studentId,
    status: enrollment.status,
  }
}

export interface DevActivitiesSeedCounts {
  activities: number
  activityEnrollments: number
  classActivityEnrollments: number
}

export async function seedDevActivities(
  port: ActivitiesSeedPort,
  dataset: FixtureDataset,
): Promise<DevActivitiesSeedCounts> {
  const activities = dataset.entities.activities ?? []
  const enrollments = dataset.entities.activityEnrollments ?? []
  const classActivityEnrollments = dataset.entities.classActivityEnrollments ?? []

  for (const activity of activities) {
    await port.saveActivity(activitySeedRecord(activity))
  }

  for (const enrollment of classActivityEnrollments) {
    await port.saveClassActivityEnrollment({
      id: enrollment.id,
      activityId: enrollment.activityId,
      classGroupId: enrollment.classGroupId,
    })
  }

  for (const enrollment of enrollments) {
    await port.saveEnrollment(enrollmentSeedRecord(enrollment))
  }

  return {
    activities: activities.length,
    activityEnrollments: enrollments.length,
    classActivityEnrollments: classActivityEnrollments.length,
  }
}
