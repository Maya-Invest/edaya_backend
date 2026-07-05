import type { FixtureDataset, FixtureSchedulingSlot } from '@edaya/fixtures'
import type { SchedulingSeedPort } from './port'
import { planningSessionDateForDayOfWeek } from '@edaya/fixtures/meta/dates'
import { seedDateAndTime } from '../../support/seed-date'

function lessonSessionIdForSlot(
  scheduleId: string,
  dayOfWeek: NonNullable<FixtureSchedulingSlot['schedule']['dayOfWeek']>,
): string {
  return `${scheduleId}:${planningSessionDateForDayOfWeek(dayOfWeek)}`
}

export async function seedDevScheduling(
  port: SchedulingSeedPort,
  dataset: FixtureDataset,
): Promise<void> {
  const resources = dataset.entities.resources ?? []
  const slots = dataset.extensions?.schedulingSlots ?? []
  const anchor = dataset.extensions?.schedulingSessionProgressAnchor
  const academicYearId = dataset.entities.academicYear?.id
    ?? (() => { throw new Error('Fixture dataset must include academicYear for scheduling seed') })()

  for (const resource of resources) {
    await port.saveResource({
      id: resource.id,
      schoolId: resource.schoolId,
      name: resource.name,
      kind: resource.kind,
      capacity: resource.capacity ?? undefined,
      description: typeof resource.description === 'string' ? resource.description : undefined,
    })
  }

  for (const assignment of dataset.extensions?.classResourceAssignments ?? []) {
    if (!assignment.classGroupId) {
      throw new Error(`Class resource assignment ${assignment.id} is missing classGroupId`)
    }
    await port.assignResourceToClass({
      id: assignment.id,
      resourceId: assignment.resourceId,
      classGroupId: assignment.classGroupId,
    })
  }

  for (const slot of slots) {
    const { schedule } = slot
    if (!schedule.dayOfWeek) {
      throw new Error(`Scheduling slot ${slot.slotId} is missing dayOfWeek`)
    }

    await port.createSchedule({
      id: schedule.id,
      schoolId: schedule.schoolId,
      classGroupId: schedule.classGroupId,
      classSubjectId: schedule.classSubjectId ?? undefined,
      title: schedule.title,
      isRecurring: schedule.isRecurring,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    })
  }

  for (const slot of slots) {
    const { schedule, teacherId, resourceId } = slot
    if (!schedule.dayOfWeek) {
      throw new Error(`Scheduling slot ${slot.slotId} is missing dayOfWeek`)
    }

    await port.materializeSchedule({ scheduleId: schedule.id })
    const lessonSessionId = lessonSessionIdForSlot(schedule.id, schedule.dayOfWeek)

    await port.assignStaffToLessonSession({
      id: `sa-${lessonSessionId}-${teacherId}`,
      staffId: teacherId,
      academicYearId,
      responsibility: 'Teacher',
      lessonSessionId,
    })

    if (resourceId) {
      await port.assignResourceToLessonSession({
        id: `ra-${lessonSessionId}-${resourceId}`,
        resourceId,
        lessonSessionId,
      })
    }
  }

  if (!anchor) {
    return
  }

  const progressLessonSessionId = lessonSessionIdForSlot(anchor.scheduleId, anchor.dayOfWeek)
  await port.recordLessonSessionProgress({
    id: anchor.progress.id,
    classSubjectMatterId: anchor.progress.classSubjectMatterId,
    lessonSessionId: progressLessonSessionId,
    completedPercentage: anchor.progress.completedPercentage,
    notes: anchor.progress.notes,
    recordedAt: seedDateAndTime(planningSessionDateForDayOfWeek(anchor.dayOfWeek), anchor.recordedAtTime),
  })
}
