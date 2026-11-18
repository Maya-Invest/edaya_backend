import type { DayOfWeek, ResourceKind, ScheduleKind } from '@edaya/core'

export interface ResourceSeedRecord {
  id: string
  schoolId: string
  name: string
  kind: ResourceKind
  capacity?: number
  description?: string
}

export interface ScheduleSeedRecord {
  id: string
  schoolId: string
  classGroupId: string
  scheduleKind?: ScheduleKind
  classSubjectId?: string
  activityId?: string
  title: string
  isRecurring: boolean
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
}

export interface ClassResourceAssignmentSeedRecord {
  id: string
  resourceId: string
  classGroupId: string
}

export interface LessonSessionStaffAssignmentSeedRecord {
  id: string
  staffId: string
  academicYearId: string
  responsibility: string
  lessonSessionId: string
}

export interface LessonSessionResourceAssignmentSeedRecord {
  id: string
  resourceId: string
  lessonSessionId: string
}

export interface LessonSessionProgressSeedRecord {
  id: string
  classSubjectMatterId: string
  lessonSessionId: string
  completed: boolean
  notes?: string
  recordedAt: string
}

export interface SchedulingSeedPort {
  saveResource: (record: ResourceSeedRecord) => Promise<void>
  createSchedule: (record: ScheduleSeedRecord) => Promise<void>
  materializeSchedule: (input: { scheduleId: string }) => Promise<void>
  assignStaffToLessonSession: (record: LessonSessionStaffAssignmentSeedRecord) => Promise<void>
  assignResourceToClass: (record: ClassResourceAssignmentSeedRecord) => Promise<void>
  assignResourceToLessonSession: (record: LessonSessionResourceAssignmentSeedRecord) => Promise<void>
  recordLessonSessionProgress: (record: LessonSessionProgressSeedRecord) => Promise<void>
}
