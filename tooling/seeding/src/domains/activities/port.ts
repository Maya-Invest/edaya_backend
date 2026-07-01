import type { ActivityCategory, ActivityEnrollmentStatus } from '@edaya/core'

export interface ActivitySeedRecord {
  id: string
  schoolId: string
  name: string
  category: ActivityCategory
  coach: string
  schedule: string
  participants: number
  capacity: number
  description: string
  startDate: string
  endDate: string
}

export interface ActivityEnrollmentSeedRecord {
  id: string
  activityId: string
  studentId: string
  status: ActivityEnrollmentStatus
}

export interface ActivitiesSeedPort {
  saveActivity: (record: ActivitySeedRecord) => Promise<void>
  saveEnrollment: (record: ActivityEnrollmentSeedRecord) => Promise<void>
}
