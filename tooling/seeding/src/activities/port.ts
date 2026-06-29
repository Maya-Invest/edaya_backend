import type { ActivityEnrollmentStatus, ExtracurricularActivityCategory } from '@edaya/core'

export interface ExtracurricularActivitySeedRecord {
  id: string
  schoolId: string
  name: string
  category: ExtracurricularActivityCategory
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
  saveActivity: (record: ExtracurricularActivitySeedRecord) => Promise<void>
  saveEnrollment: (record: ActivityEnrollmentSeedRecord) => Promise<void>
}
