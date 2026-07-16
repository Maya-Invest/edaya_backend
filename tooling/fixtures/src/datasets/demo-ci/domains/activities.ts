import type { ActivityEnrollmentInput, ActivityInput, ClassActivityEnrollmentInput } from '@edaya/core'
import { ActivityCategory, ActivityEnrollmentStatus } from '@edaya/core'
import { DEMO_CI_SCHOOL_ID } from '../../../shared/ids'

export const demoCiActivities = [
  {
    id: 'ci-act-robot',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Club Robotique',
    category: ActivityCategory.Science,
    coach: 'M. Gbé',
    schedule: 'Mer 14:00 – 16:00',
    participants: 12,
    capacity: 20,
    description: 'Conception et programmation de robots avec Arduino.',
    startDate: '2025-09-15T12:00:00.000Z',
    endDate: '2026-06-12T12:00:00.000Z',
  },
  {
    id: 'ci-act-chorale',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Chorale scolaire',
    category: ActivityCategory.Arts,
    coach: 'Mme Zongo',
    schedule: 'Ven 12:30 – 13:30',
    participants: 18,
    capacity: 30,
    description: 'Ensemble vocal préparant les concerts trimestriels.',
    startDate: '2025-09-20T12:00:00.000Z',
    endDate: '2026-06-20T12:00:00.000Z',
  },
  {
    id: 'ci-act-foot',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Équipe de football',
    category: ActivityCategory.Sport,
    coach: 'M. Diomandé',
    schedule: 'Mar & Jeu 17:00',
    participants: 16,
    capacity: 18,
    description: 'Entraînements et tournois inter-établissements.',
    startDate: '2025-09-08T12:00:00.000Z',
    endDate: '2026-05-30T12:00:00.000Z',
  },
  {
    id: 'ci-act-anglais',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Conversation anglaise',
    category: ActivityCategory.Language,
    coach: 'Mme Touré',
    schedule: 'Lun 13:00 – 14:00',
    participants: 8,
    capacity: 15,
    description: 'Ateliers d\'expression orale en petits groupes.',
    startDate: '2025-10-01T12:00:00.000Z',
    endDate: '2026-06-05T12:00:00.000Z',
  },
  {
    id: 'ci-act-theatre',
    schoolId: DEMO_CI_SCHOOL_ID,
    name: 'Atelier théâtre',
    category: ActivityCategory.Arts,
    coach: 'Mme Assi',
    schedule: 'Mer 16:00 – 18:00',
    participants: 14,
    capacity: 20,
    description: 'Mise en scène d\'une pièce jouée en fin d\'année.',
    startDate: '2025-10-05T12:00:00.000Z',
    endDate: '2026-06-25T12:00:00.000Z',
  },
] as const satisfies readonly ActivityInput[]

export const demoCiActivityEnrollments = [
  { id: 'ci-ae-robot-s1', activityId: 'ci-act-robot', studentId: 'ci-s1', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-robot-s2', activityId: 'ci-act-robot', studentId: 'ci-s2', status: ActivityEnrollmentStatus.Pending },
  { id: 'ci-ae-robot-s3', activityId: 'ci-act-robot', studentId: 'ci-s3', status: ActivityEnrollmentStatus.Denied },
  { id: 'ci-ae-robot-s4', activityId: 'ci-act-robot', studentId: 'ci-s4', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-chorale-s5', activityId: 'ci-act-chorale', studentId: 'ci-s5', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-chorale-s6', activityId: 'ci-act-chorale', studentId: 'ci-s6', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-chorale-s11', activityId: 'ci-act-chorale', studentId: 'ci-s11', status: ActivityEnrollmentStatus.Pending },
  { id: 'ci-ae-foot-s8', activityId: 'ci-act-foot', studentId: 'ci-s8', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-foot-s17', activityId: 'ci-act-foot', studentId: 'ci-s17', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-foot-s23', activityId: 'ci-act-foot', studentId: 'ci-s23', status: ActivityEnrollmentStatus.Pending },
  { id: 'ci-ae-anglais-s1', activityId: 'ci-act-anglais', studentId: 'ci-s1', status: ActivityEnrollmentStatus.Pending },
  { id: 'ci-ae-anglais-s12', activityId: 'ci-act-anglais', studentId: 'ci-s12', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-theatre-s3', activityId: 'ci-act-theatre', studentId: 'ci-s3', status: ActivityEnrollmentStatus.Approved },
  { id: 'ci-ae-theatre-s14', activityId: 'ci-act-theatre', studentId: 'ci-s14', status: ActivityEnrollmentStatus.Pending },
  { id: 'ci-ae-theatre-s28', activityId: 'ci-act-theatre', studentId: 'ci-s28', status: ActivityEnrollmentStatus.Approved },
] as const satisfies readonly ActivityEnrollmentInput[]

/** Links school activities to class groups for class timetable display. */
export const demoCiClassActivityEnrollments = [
  {
    id: 'ci-cae-6a-anglais',
    activityId: 'ci-act-anglais',
    classGroupId: 'ci-6a',
  },
] as const satisfies readonly ClassActivityEnrollmentInput[]
