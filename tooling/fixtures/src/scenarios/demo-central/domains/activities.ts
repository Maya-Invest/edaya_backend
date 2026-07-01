import { SEED_ACTIVITIES } from './activities-deadlines-seed'
import { SEED_SCHOOL_ID } from './dataset'

export const SEED_EXTRACURRICULAR_ACTIVITIES = SEED_ACTIVITIES.map(({ enrollments: _enrollments, ...activity }) => ({
  ...activity,
  schoolId: SEED_SCHOOL_ID,
}))

export const SEED_ACTIVITY_ENROLLMENTS = SEED_ACTIVITIES.flatMap(activity =>
  activity.enrollments.map(enrollment => ({
    id: `ae-${activity.id}-${enrollment.studentId}`,
    activityId: activity.id,
    studentId: enrollment.studentId,
    status: enrollment.status,
  })),
)
