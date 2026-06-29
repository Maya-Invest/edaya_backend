import type { ActivitiesSeedPort } from './port'
import { ActivityEnrollmentStatus, ExtracurricularActivityCategory } from '@edaya/core'
import { SEED_ACTIVITY_ENROLLMENTS, SEED_EXTRACURRICULAR_ACTIVITIES } from '@edaya/dev-fixtures'
import { seedDateTime } from '../seed-date'

const ACTIVITY_CATEGORY_BY_SEED = {
  Sport: ExtracurricularActivityCategory.Sport,
  Arts: ExtracurricularActivityCategory.Arts,
  Science: ExtracurricularActivityCategory.Science,
  Language: ExtracurricularActivityCategory.Language,
  Wellbeing: ExtracurricularActivityCategory.Wellbeing,
} as const

const ENROLLMENT_STATUS_BY_SEED = {
  approved: ActivityEnrollmentStatus.Approved,
  pending: ActivityEnrollmentStatus.Pending,
  denied: ActivityEnrollmentStatus.Denied,
} as const

export interface DevActivitiesSeedCounts {
  activities: number
  activityEnrollments: number
}

export async function seedDevActivities(
  port: ActivitiesSeedPort,
): Promise<DevActivitiesSeedCounts> {
  for (const activity of SEED_EXTRACURRICULAR_ACTIVITIES) {
    await port.saveActivity({
      id: activity.id,
      schoolId: activity.schoolId,
      name: activity.name,
      category: ACTIVITY_CATEGORY_BY_SEED[activity.category],
      coach: activity.coach,
      schedule: activity.schedule,
      participants: activity.participants,
      capacity: activity.capacity,
      description: activity.description,
      startDate: seedDateTime(activity.startDate),
      endDate: seedDateTime(activity.endDate),
    })
  }

  for (const enrollment of SEED_ACTIVITY_ENROLLMENTS) {
    await port.saveEnrollment({
      id: enrollment.id,
      activityId: enrollment.activityId,
      studentId: enrollment.studentId,
      status: ENROLLMENT_STATUS_BY_SEED[enrollment.status],
    })
  }

  return {
    activities: SEED_EXTRACURRICULAR_ACTIVITIES.length,
    activityEnrollments: SEED_ACTIVITY_ENROLLMENTS.length,
  }
}
