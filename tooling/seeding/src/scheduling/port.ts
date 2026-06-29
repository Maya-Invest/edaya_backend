import type {
  DayOfWeek,
  ResourceKind,
  SessionKind,
} from '@edaya/core'

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
  classGroupId: string
  classSubjectId?: string
  title: string
  isRecurring: boolean
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
}

export interface SessionSeedRecord {
  id: string
  classGroupId: string
  classSubjectId?: string
  scheduleId?: string
  title: string
  kind: SessionKind
  startsAt: string
  endsAt: string
}

export interface SessionStaffAssignmentSeedRecord {
  id: string
  staffId: string
  responsibility: string
  sessionId: string
}

export interface SessionResourceAssignmentSeedRecord {
  id: string
  resourceId: string
  sessionId: string
}

export interface SessionProgressSeedRecord {
  id: string
  classSubjectMatterId: string
  sessionId: string
  completedPercentage: number
  notes?: string
  recordedAt: string
}

export interface SchedulingSeedPort {
  saveResource: (record: ResourceSeedRecord) => Promise<void>
  createSchedule: (record: ScheduleSeedRecord) => Promise<void>
  createSession: (record: SessionSeedRecord) => Promise<void>
  assignStaffToSession: (record: SessionStaffAssignmentSeedRecord) => Promise<void>
  assignResourceToSession: (record: SessionResourceAssignmentSeedRecord) => Promise<void>
  recordSessionProgress: (record: SessionProgressSeedRecord) => Promise<void>
}
