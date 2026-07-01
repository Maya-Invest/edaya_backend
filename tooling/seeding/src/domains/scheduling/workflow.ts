import type { SchedulingSeedPort } from './port'
import { DayOfWeek, ResourceKind } from '@edaya/core'
import {
  planningSessionDate,
  SEED_PLANNING_SLOTS,
  SEED_RESOURCES,
  SEED_SCHOOL_ID,
  SEED_SESSION_PROGRESS,
} from '@edaya/fixtures'
import { seedDateAndTime } from '../../support/seed-date'

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

function lessonSessionIdForSlot(scheduleId: string, day: keyof typeof DAY_OF_WEEK_BY_SEED): string {
  return `${scheduleId}:${planningSessionDate(day)}`
}

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
      schoolId: SEED_SCHOOL_ID,
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
    await port.materializeSchedule({ scheduleId: slot.scheduleId })
    const lessonSessionId = lessonSessionIdForSlot(slot.scheduleId, slot.day)

    await port.assignStaffToLessonSession({
      id: `sa-${lessonSessionId}-${slot.teacherId}`,
      staffId: slot.teacherId,
      responsibility: 'Teacher',
      lessonSessionId,
    })

    if ('resourceId' in slot && slot.resourceId) {
      await port.assignResourceToLessonSession({
        id: `ra-${lessonSessionId}-${slot.resourceId}`,
        resourceId: slot.resourceId,
        lessonSessionId,
      })
    }
  }

  const progressLessonSessionId = lessonSessionIdForSlot('sch-p1', 'Mon')
  await port.recordLessonSessionProgress({
    id: SEED_SESSION_PROGRESS.id,
    classSubjectMatterId: SEED_SESSION_PROGRESS.classSubjectMatterId,
    lessonSessionId: progressLessonSessionId,
    completedPercentage: SEED_SESSION_PROGRESS.completedPercentage,
    notes: SEED_SESSION_PROGRESS.notes,
    recordedAt: seedDateAndTime(planningSessionDate('Mon'), '09:00'),
  })
}
