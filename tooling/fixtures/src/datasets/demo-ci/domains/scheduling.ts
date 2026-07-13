import type { ResourceAssignmentInput, ResourceInput, ScheduleInput } from '@edaya/core'
import type { FixtureSchedulingSessionProgressAnchor, FixtureSchedulingSlot } from '../../types'
import { DayOfWeek, ResourceKind, ScheduleKind } from '@edaya/core'
import { DEMO_CI_SCHOOL_ID } from '../../../shared/ids'

export const demoCiResources = [
  {
    id: 'ci-r-salle-6a',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Salle 6ème A',
    kind: ResourceKind.Location,
    capacity: 35,
    description: 'Bâtiment principal · RDC',
  },
  {
    id: 'ci-r-salle-5a',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Salle 5ème A',
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

/** Recurring lesson slots for Mme Touré (ci-t1) — math in 6ème A and 5ème A. */
export const demoCiSchedulingSlots = [
  {
    slotId: 'ci-p-6a-math-mon',
    teacherId: 'ci-t1',
    resourceId: 'ci-r-salle-6a',
    schedule: {
      id: 'sch-ci-6a-math-mon',
      schoolId: DEMO_CI_SCHOOL_ID,
      classGroupId: 'ci-6a',
      classSubjectId: 'ci-cs-6a-math',
      title: 'Mathématiques — fractions',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Monday,
      startTime: '08:15',
      endTime: '09:00',
    },
  },
  {
    slotId: 'ci-p-6a-math-wed',
    teacherId: 'ci-t1',
    resourceId: undefined,
    schedule: {
      id: 'sch-ci-6a-math-wed',
      schoolId: DEMO_CI_SCHOOL_ID,
      classGroupId: 'ci-6a',
      classSubjectId: 'ci-cs-6a-math',
      title: 'Mathématiques — géométrie',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Wednesday,
      startTime: '09:15',
      endTime: '10:00',
    },
  },
  {
    slotId: 'ci-p-5a-math-tue',
    teacherId: 'ci-t1',
    resourceId: 'ci-r-salle-5a',
    schedule: {
      id: 'sch-ci-5a-math-tue',
      schoolId: DEMO_CI_SCHOOL_ID,
      classGroupId: 'ci-5a',
      classSubjectId: 'ci-cs-5a-math',
      title: 'Mathématiques — équations',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Tuesday,
      startTime: '08:15',
      endTime: '09:00',
    },
  },
  {
    slotId: 'ci-p-5a-math-thu',
    teacherId: 'ci-t1',
    resourceId: 'ci-r-lab-pc',
    schedule: {
      id: 'sch-ci-5a-math-thu',
      schoolId: DEMO_CI_SCHOOL_ID,
      classGroupId: 'ci-5a',
      classSubjectId: 'ci-cs-5a-math',
      title: 'Mathématiques — probabilités',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Thursday,
      startTime: '10:00',
      endTime: '10:45',
    },
  },
  {
    slotId: 'ci-p-6b-fr-mon',
    teacherId: 'ci-t3',
    resourceId: undefined,
    schedule: {
      id: 'sch-ci-6b-fr-mon',
      schoolId: DEMO_CI_SCHOOL_ID,
      classGroupId: 'ci-6b',
      classSubjectId: 'ci-cs-6b-fr',
      title: 'Français — lecture',
      isRecurring: true,
      dayOfWeek: DayOfWeek.Monday,
      startTime: '08:15',
      endTime: '09:00',
    },
  },
  {
    slotId: 'ci-p-6a-anglais-mon',
    teacherId: 'ci-t1',
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
] as const satisfies readonly FixtureSchedulingSlot[]

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
