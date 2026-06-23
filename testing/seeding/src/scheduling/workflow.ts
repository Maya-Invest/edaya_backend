import type { SchedulingSeedPort } from './port'
import { DayOfWeek, ResourceKind, SessionKind } from '@edaya/core'
import {
  planningSessionDate,
  SEED_PLANNING_SLOTS,
  SEED_RESOURCES,
  SEED_SCHOOL_ID,
  SEED_SESSION_PROGRESS,
} from '@edaya/dev-fixtures'
import { seedDateAndTime } from '../seed-date'

const DAY_OF_WEEK_BY_SEED = {
  Mon: DayOfWeek.Monday,
  Tue: DayOfWeek.Tuesday,
  Wed: DayOfWeek.Wednesday,
  Thu: DayOfWeek.Thursday,
  Fri: DayOfWeek.Friday,
} as const

const RESOURCE_KIND_BY_SEED = {
  location: ResourceKind.Location,
  equipment: ResourceKind.Equipment,
  vehicle: ResourceKind.Vehicle,
} as const

export async function seedDevScheduling(port: SchedulingSeedPort): Promise<void> {
  for (const resource of SEED_RESOURCES) {
    await port.saveResource({
      id: resource.id,
      schoolId: SEED_SCHOOL_ID,
      name: resource.name,
      kind: RESOURCE_KIND_BY_SEED[resource.kind],
      capacity: 'capacity' in resource ? resource.capacity : undefined,
      description: resource.description,
    })
  }

  for (const slot of SEED_PLANNING_SLOTS) {
    await port.createSchedule({
      id: slot.scheduleId,
      classGroupId: slot.classGroupId,
      classSubjectId: slot.classSubjectId,
      title: slot.title,
      isRecurring: true,
      dayOfWeek: DAY_OF_WEEK_BY_SEED[slot.day],
      startTime: slot.startTime,
      endTime: slot.endTime,
    })
  }

  for (const slot of SEED_PLANNING_SLOTS) {
    const sessionDate = planningSessionDate(slot.day)
    await port.createSession({
      id: slot.sessionId,
      classGroupId: slot.classGroupId,
      classSubjectId: slot.classSubjectId,
      scheduleId: slot.scheduleId,
      title: slot.title,
      kind: SessionKind.Course,
      startsAt: seedDateAndTime(sessionDate, slot.startTime),
      endsAt: seedDateAndTime(sessionDate, slot.endTime),
    })

    await port.assignStaffToSession({
      id: `sa-${slot.sessionId}-${slot.teacherId}`,
      staffId: slot.teacherId,
      responsibility: 'Teacher',
      sessionId: slot.sessionId,
    })

    if ('resourceId' in slot && slot.resourceId) {
      await port.assignResourceToSession({
        id: `ra-${slot.sessionId}-${slot.resourceId}`,
        resourceId: slot.resourceId,
        sessionId: slot.sessionId,
      })
    }
  }

  await port.recordSessionProgress({
    id: SEED_SESSION_PROGRESS.id,
    classSubjectMatterId: SEED_SESSION_PROGRESS.classSubjectMatterId,
    sessionId: SEED_SESSION_PROGRESS.sessionId,
    completedPercentage: SEED_SESSION_PROGRESS.completedPercentage,
    notes: SEED_SESSION_PROGRESS.notes,
    recordedAt: seedDateAndTime(planningSessionDate('Mon'), '09:00'),
  })
}
