import type { ResourceAssignmentInput, ResourceInput, ScheduleInput } from '@edaya/core'
import type { FixtureSchedulingSessionProgressAnchor, FixtureSchedulingSlot } from '../../types'
import { DayOfWeek, ResourceKind, ScheduleKind } from '@edaya/core'
import { DEMO_CI_SCHOOL_ID } from '../../../shared/ids'

export const demoCiResources = [
  {
    id: 'ci-r-salle-6a',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Salle 6ème 1',
    kind: ResourceKind.Location,
    capacity: 35,
    description: 'Bâtiment principal · RDC',
  },
  {
    id: 'ci-r-salle-5a',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Salle 5ème 1',
    kind: ResourceKind.Location,
    capacity: 35,
    description: 'Bâtiment principal · 1er étage',
  },
  {
    id: 'ci-r-lab-pc',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Laboratoire PC',
    kind: ResourceKind.Location,
    capacity: 24,
    description: 'Bâtiment sciences',
  },
] as const satisfies readonly ResourceInput[]

export const demoCiClassResourceAssignments = [
  {
    id: 'ci-ra-6a-salle',
    resourceId: 'ci-r-salle-6a',
    classGroupId: 'ci-6a',
  },
  {
    id: 'ci-ra-5a-salle',
    resourceId: 'ci-r-salle-5a',
    classGroupId: 'ci-5a',
  },
] as const satisfies readonly ResourceAssignmentInput[]

function lessonSlot(input: {
  slug: string
  teacherId: string
  classGroupId: string
  classSubjectId: string
  title: string
  dayOfWeek: DayOfWeek
  startTime: string
  endTime: string
  resourceId?: string
}): FixtureSchedulingSlot {
  return {
    slotId: `ci-p-${input.slug}`,
    teacherId: input.teacherId,
    resourceId: input.resourceId,
    schedule: {
      id: `sch-${input.slug}`,
      schoolId: DEMO_CI_SCHOOL_ID,
      classGroupId: input.classGroupId,
      classSubjectId: input.classSubjectId,
      title: input.title,
      isRecurring: true,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
    },
  }
}

/** Recurring week for 6ème 1 (Aminata) plus a few collège slots for other classes. */
export const demoCiSchedulingSlots: readonly FixtureSchedulingSlot[] = [
  lessonSlot({
    slug: 'ci-6a-math-mon',
    teacherId: 'ci-t1',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-math',
    title: 'Mathématiques — fractions',
    dayOfWeek: DayOfWeek.Monday,
    startTime: '08:15',
    endTime: '09:00',
    resourceId: 'ci-r-salle-6a',
  }),
  lessonSlot({
    slug: 'ci-6a-fr-mon',
    teacherId: 'ci-t3',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-fr',
    title: 'Français — lecture',
    dayOfWeek: DayOfWeek.Monday,
    startTime: '09:15',
    endTime: '10:00',
    resourceId: 'ci-r-salle-6a',
  }),
  {
    slotId: 'ci-p-6a-anglais-mon',
    teacherId: 'ci-t5',
    resourceId: undefined,
    schedule: {
      id: 'sch-ci-6a-anglais-mon',
      schoolId: DEMO_CI_SCHOOL_ID,
      classGroupId: 'ci-6a',
      scheduleKind: ScheduleKind.Activity,
      activityId: 'ci-act-anglais',
      title: 'Conversation anglaise',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Monday,
      startTime: '13:00',
      endTime: '14:00',
    },
  },
  lessonSlot({
    slug: 'ci-6a-hg-tue',
    teacherId: 'ci-t4',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-hg',
    title: 'Histoire-Géographie',
    dayOfWeek: DayOfWeek.Tuesday,
    startTime: '08:15',
    endTime: '09:00',
    resourceId: 'ci-r-salle-6a',
  }),
  lessonSlot({
    slug: 'ci-6a-svt-tue',
    teacherId: 'ci-t5',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-svt',
    title: 'SVT',
    dayOfWeek: DayOfWeek.Tuesday,
    startTime: '10:00',
    endTime: '10:45',
    resourceId: 'ci-r-salle-6a',
  }),
  lessonSlot({
    slug: 'ci-6a-math-wed',
    teacherId: 'ci-t1',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-math',
    title: 'Mathématiques — géométrie',
    dayOfWeek: DayOfWeek.Wednesday,
    startTime: '09:15',
    endTime: '10:00',
  }),
  lessonSlot({
    slug: 'ci-6a-edhc-wed',
    teacherId: 'ci-t4',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-edhc',
    title: 'EDHC',
    dayOfWeek: DayOfWeek.Wednesday,
    startTime: '10:15',
    endTime: '11:00',
  }),
  lessonSlot({
    slug: 'ci-6a-ang-thu',
    teacherId: 'ci-t5',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-ang',
    title: 'Anglais',
    dayOfWeek: DayOfWeek.Thursday,
    startTime: '08:15',
    endTime: '09:00',
    resourceId: 'ci-r-salle-6a',
  }),
  lessonSlot({
    slug: 'ci-6a-fr-thu',
    teacherId: 'ci-t3',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-fr',
    title: 'Français — expression',
    dayOfWeek: DayOfWeek.Thursday,
    startTime: '10:00',
    endTime: '10:45',
    resourceId: 'ci-r-salle-6a',
  }),
  lessonSlot({
    slug: 'ci-6a-eps-fri',
    teacherId: 'ci-t2',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-eps',
    title: 'EPS',
    dayOfWeek: DayOfWeek.Friday,
    startTime: '08:15',
    endTime: '09:00',
  }),
  lessonSlot({
    slug: 'ci-6a-svt-fri',
    teacherId: 'ci-t5',
    classGroupId: 'ci-6a',
    classSubjectId: 'ci-cs-6a-svt',
    title: 'SVT',
    dayOfWeek: DayOfWeek.Friday,
    startTime: '10:00',
    endTime: '10:45',
  }),
  lessonSlot({
    slug: 'ci-5a-math-tue',
    teacherId: 'ci-t1',
    classGroupId: 'ci-5a',
    classSubjectId: 'ci-cs-5a-math',
    title: 'Mathématiques — équations',
    dayOfWeek: DayOfWeek.Tuesday,
    startTime: '08:15',
    endTime: '09:00',
    resourceId: 'ci-r-salle-5a',
  }),
  lessonSlot({
    slug: 'ci-5a-math-thu',
    teacherId: 'ci-t1',
    classGroupId: 'ci-5a',
    classSubjectId: 'ci-cs-5a-math',
    title: 'Mathématiques — probabilités',
    dayOfWeek: DayOfWeek.Thursday,
    startTime: '10:00',
    endTime: '10:45',
    resourceId: 'ci-r-lab-pc',
  }),
  lessonSlot({
    slug: 'ci-6b-fr-mon',
    teacherId: 'ci-t3',
    classGroupId: 'ci-6b',
    classSubjectId: 'ci-cs-6b-fr',
    title: 'Français — lecture',
    dayOfWeek: DayOfWeek.Monday,
    startTime: '08:15',
    endTime: '09:00',
  }),
]

export const demoCiSchedulingSessionProgressAnchors = [
  {
    progress: {
      id: 'ci-csp-6a-math-fractions',
      classSubjectMatterId: 'csm-ci-cs-6a-math-ci-sm-math-fractions',
      completedPercentage: 60,
      notes: 'Exercices sur les fractions irréductibles et les pourcentages.',
    },
    scheduleId: 'sch-ci-6a-math-mon',
    dayOfWeek: DayOfWeek.Monday,
    recordedAtTime: '08:45',
  },
  {
    progress: {
      id: 'ci-csp-6a-math-geometrie',
      classSubjectMatterId: 'csm-ci-cs-6a-math-ci-sm-math-geometrie',
      completedPercentage: 25,
      notes: 'Construction de triangles avec règle et compas.',
    },
    scheduleId: 'sch-ci-6a-math-wed',
    dayOfWeek: DayOfWeek.Wednesday,
    recordedAtTime: '09:45',
  },
  {
    progress: {
      id: 'ci-csp-6b-fr-lecture',
      classSubjectMatterId: 'csm-ci-cs-6b-fr-ci-sm-fr-lecture',
      completedPercentage: 40,
      notes: 'Analyse d\'un texte narratif — repérage des personnages.',
    },
    scheduleId: 'sch-ci-6b-fr-mon',
    dayOfWeek: DayOfWeek.Monday,
    recordedAtTime: '08:45',
  },
] as const satisfies readonly FixtureSchedulingSessionProgressAnchor[]

export const demoCiSchedules = demoCiSchedulingSlots.map(slot => slot.schedule) as readonly ScheduleInput[]
