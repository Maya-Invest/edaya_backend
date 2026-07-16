import type { FixtureDataset, FixtureSchedulingSlot } from '@edaya/fixtures'
import type { SchedulingSeedPort } from './port'
import { ScheduleKind } from '@edaya/core'
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
  const skipLessonSessions = dataset.extensions?.skipLessonSessionSeeding === true
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
      scheduleKind: schedule.scheduleKind,
      classSubjectId: schedule.classSubjectId ?? undefined,
      activityId: schedule.activityId ?? undefined,
      title: schedule.title,
      isRecurring: schedule.isRecurring,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    })
  }

  if (skipLessonSessions) {
    return
  }

  for (const slot of slots) {
    const { schedule, lessonSessionStaffId, resourceId } = slot
    if (!schedule.dayOfWeek) {
      throw new Error(`Scheduling slot ${slot.slotId} is missing dayOfWeek`)
    }

    await port.materializeSchedule({ scheduleId: schedule.id })

    if (schedule.scheduleKind === ScheduleKind.Activity || schedule.activityId) {
      continue
    }

    const lessonSessionId = lessonSessionIdForSlot(schedule.id, schedule.dayOfWeek)

    if (lessonSessionStaffId) {
      await port.assignStaffToLessonSession({
        id: `sa-${lessonSessionId}-${lessonSessionStaffId}`,
        staffId: lessonSessionStaffId,
        academicYearId,
        responsibility: 'Teacher',
        lessonSessionId,
      })
    }

    if (resourceId) {
      await port.assignResourceToLessonSession({
        id: `ra-${lessonSessionId}-${resourceId}`,
        resourceId,
        lessonSessionId,
      })
    }
  }

  if (!anchor && !(dataset.extensions?.schedulingSessionProgressAnchors?.length)) {
    return
  }

  const progressAnchors = [
    ...(dataset.extensions?.schedulingSessionProgressAnchors ?? []),
    ...(anchor ? [anchor] : []),
  ]

  for (const progressAnchor of progressAnchors) {
    const progressLessonSessionId = lessonSessionIdForSlot(
      progressAnchor.scheduleId,
      progressAnchor.dayOfWeek,
    )
    await port.recordLessonSessionProgress({
      id: progressAnchor.progress.id,
      classSubjectMatterId: progressAnchor.progress.classSubjectMatterId,
      lessonSessionId: progressLessonSessionId,
      completedPercentage: progressAnchor.progress.completedPercentage,
      notes: progressAnchor.progress.notes,
      recordedAt: seedDateAndTime(
        planningSessionDateForDayOfWeek(progressAnchor.dayOfWeek),
        progressAnchor.recordedAtTime,
      ),
    })
  }
}
