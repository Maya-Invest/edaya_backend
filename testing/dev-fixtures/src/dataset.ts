/**
 * Shared dev fixture IDs and records for API seeding, integration tests, and webapp mock migration.
 * Canonical source — align `apps/webapp/src/lib/data/school.ts` with this package over time.
 */

export const SEED_SCHOOL_ID = 'sch-edaya-central'

export const SEED_SCHOOL_PROFILE = {
  id: SEED_SCHOOL_ID,
  name: 'EDAYA — Campus Central',
  timeZone: 'Europe/Paris',
  city: 'Paris',
  country: 'FR',
} as const

export const SEED_ACADEMIC_YEAR_ID = '2025'

export const SEED_GRADE_LEVELS = [
  { id: 'gl-6', name: '6ème', cycle: 'Middle School', order: 1 },
  { id: 'gl-5', name: '5ème', cycle: 'Middle School', order: 2 },
  { id: 'gl-4', name: '4ème', cycle: 'Middle School', order: 3 },
  { id: 'gl-3', name: '3ème', cycle: 'Middle School', order: 4 },
  { id: 'gl-2', name: '2nde', cycle: 'High School', order: 5 },
  { id: 'gl-1', name: '1ère', cycle: 'High School', order: 6 },
  { id: 'gl-t', name: 'Terminale', cycle: 'High School', order: 7 },
] as const

export const SEED_CLASSES = [
  { id: '6a', gradeLevelId: 'gl-6', name: '6th — A', capacity: 30 },
  { id: '6b', gradeLevelId: 'gl-6', name: '6th — B', capacity: 30 },
  { id: '5a', gradeLevelId: 'gl-5', name: '5th — A', capacity: 30 },
] as const

/** All staff from `apps/webapp/src/lib/data/school.ts` — st5 first (school owner). */
export const SEED_STAFF = [
  { id: 'st5', name: 'Camille Moreau', email: 'c.moreau@school.edu' },
  { id: 'st3', name: 'Mme Léon', email: 'm.leon@school.edu' },
  { id: 'st1', name: 'Mme Dupont', email: 'm.dupont@school.edu' },
  { id: 'st2', name: 'M. Garnier', email: 'm.garnier@school.edu' },
  { id: 'st4', name: 'M. Cheng', email: 'm.cheng@school.edu' },
  { id: 'st6', name: 'Sarah Klein', email: 's.klein@school.edu' },
  { id: 'st7', name: 'Tom Évrard', email: 't.evrard@school.edu' },
] as const

export const SEED_STUDENTS = [
  { id: 's1', classId: '6a', name: 'Amélie Laurent', birthDate: '2014-03-12' },
  { id: 's2', classId: '6a', name: 'Noah Bennett', birthDate: '2014-07-22' },
  { id: 's3', classId: '6a', name: 'Mira Okafor', birthDate: '2014-01-09' },
  { id: 's4', classId: '6a', name: 'Theo Marchetti', birthDate: '2014-05-30' },
  { id: 's5', classId: '6a', name: 'Yuki Tanaka', birthDate: '2014-11-04' },
  { id: 's6', classId: '6a', name: 'Sofia Reyes', birthDate: '2014-08-17' },
  { id: 's7', classId: '6b', name: 'Liam Foster', birthDate: '2014-02-21' },
  { id: 's8', classId: '6b', name: 'Zara Khan', birthDate: '2014-06-11' },
] as const

export const SEED_GUARDIANS = [
  {
    id: 'g1',
    name: 'Claire Laurent',
    email: 'c.laurent@mail.com',
    phone: '+33 6 12 34 56 78',
    studentIds: ['s1'],
    relationship: 'mother',
  },
  {
    id: 'g2',
    name: 'James Bennett',
    email: 'j.bennett@mail.com',
    phone: '+33 6 22 11 09 87',
    studentIds: ['s2'],
    relationship: 'father',
  },
  {
    id: 'g3',
    name: 'Adaeze Okafor',
    email: 'a.okafor@mail.com',
    phone: '+33 6 78 90 12 34',
    studentIds: ['s3'],
    relationship: 'mother',
  },
  {
    id: 'g4',
    name: 'Luca Marchetti',
    email: 'l.marchetti@mail.com',
    phone: '+33 6 55 66 77 88',
    studentIds: ['s4'],
    relationship: 'father',
  },
  {
    id: 'g5',
    name: 'Hana Tanaka',
    email: 'h.tanaka@mail.com',
    phone: '+33 6 11 22 33 44',
    studentIds: ['s5'],
    relationship: 'mother',
  },
  {
    id: 'g6',
    name: 'Marco Reyes',
    email: 'm.reyes@mail.com',
    phone: '+33 6 88 77 66 55',
    studentIds: ['s6'],
    relationship: 'father',
  },
] as const

/** School-wide subject catalog aligned with the webapp school mock data. */
export const SEED_SUBJECT_CATALOG = [
  { id: 'subj-math', code: 'MATH', name: 'Mathematics', defaultCoefficient: 3 },
  { id: 'subj-fr', code: 'FR', name: 'French Literature', defaultCoefficient: 2 },
  { id: 'subj-hist', code: 'HIST', name: 'History & Geography', defaultCoefficient: 2 },
  { id: 'subj-sci', code: 'SCI', name: 'Natural Sciences', defaultCoefficient: 2 },
  { id: 'subj-en', code: 'EN', name: 'English', defaultCoefficient: 2 },
  { id: 'subj-eps', code: 'EPS', name: 'Physical Education', defaultCoefficient: 1 },
] as const

/** Programme breakdown used by the class-subjects webapp mapper for hours and descriptions. */
export const SEED_SUBJECT_MATTERS = [
  {
    id: 'sm-math',
    subjectId: 'subj-math',
    name: 'Core programme',
    description: 'Algebra fundamentals, geometry and problem solving.',
    sequenceOrder: 1,
    estimatedHours: 5,
  },
  {
    id: 'sm-fr',
    subjectId: 'subj-fr',
    name: 'Core programme',
    description: 'Reading, writing and analysis of classical texts.',
    sequenceOrder: 1,
    estimatedHours: 4,
  },
  {
    id: 'sm-hist',
    subjectId: 'subj-hist',
    name: 'Core programme',
    description: 'Antiquity to medieval Europe; world geography.',
    sequenceOrder: 1,
    estimatedHours: 3,
  },
  {
    id: 'sm-sci',
    subjectId: 'subj-sci',
    name: 'Core programme',
    description: 'Biology, ecology and earth sciences.',
    sequenceOrder: 1,
    estimatedHours: 3,
  },
  {
    id: 'sm-en',
    subjectId: 'subj-en',
    name: 'Core programme',
    description: 'Communication, comprehension and culture.',
    sequenceOrder: 1,
    estimatedHours: 3,
  },
  {
    id: 'sm-eps',
    subjectId: 'subj-eps',
    name: 'Core programme',
    description: 'Athletics, team sports and wellbeing.',
    sequenceOrder: 1,
    estimatedHours: 2,
  },
] as const

/** Class offerings and assigned teachers for migrated class-subjects UI. */
export const SEED_CLASS_SUBJECTS = [
  { id: 'cs-6a-math', classGroupId: '6a', subjectId: 'subj-math', coefficient: 3, teacherId: 'st1' },
  { id: 'cs-6a-fr', classGroupId: '6a', subjectId: 'subj-fr', coefficient: 2, teacherId: 'st2' },
  { id: 'cs-6a-hist', classGroupId: '6a', subjectId: 'subj-hist', coefficient: 2, teacherId: 'st3' },
  { id: 'cs-6a-sci', classGroupId: '6a', subjectId: 'subj-sci', coefficient: 2, teacherId: 'st1' },
  { id: 'cs-6a-en', classGroupId: '6a', subjectId: 'subj-en', coefficient: 2, teacherId: 'st7' },
  { id: 'cs-6a-eps', classGroupId: '6a', subjectId: 'subj-eps', coefficient: 1, teacherId: 'st7' },
  { id: 'cs-6b-math', classGroupId: '6b', subjectId: 'subj-math', coefficient: 3, teacherId: 'st1' },
  { id: 'cs-6b-fr', classGroupId: '6b', subjectId: 'subj-fr', coefficient: 2, teacherId: 'st2' },
] as const

/** Shared dev password for seeded Better Auth accounts. Dev-only — never use in production. */
export const DEV_AUTH_PASSWORD = 'DevPassword1!'

/** Staff accounts provisioned and linked during dev auth seed. */
export const DEV_AUTH_STAFF_ACCOUNTS = [
  { staffId: 'st5', email: 'c.moreau@school.edu', name: 'Camille Moreau' },
  { staffId: 'st1', email: 'm.dupont@school.edu', name: 'Mme Dupont' },
  { staffId: 'st3', email: 'm.leon@school.edu', name: 'Mme Léon' },
  { staffId: 'st7', email: 't.evrard@school.edu', name: 'Tom Évrard' },
] as const

/** Guardian accounts provisioned and linked during dev auth seed. */
export const DEV_AUTH_GUARDIAN_ACCOUNTS = [
  { guardianId: 'g1', email: 'c.laurent@mail.com', name: 'Claire Laurent' },
] as const

/** Primary staff fixture for Better Auth integration tests. */
export const MINIMAL_AUTH_FIXTURE_STAFF_ID = DEV_AUTH_STAFF_ACCOUNTS[0].staffId

/** Primary staff email for Better Auth integration tests. */
export const MINIMAL_AUTH_FIXTURE_STAFF_EMAIL = DEV_AUTH_STAFF_ACCOUNTS[0].email

/** Primary guardian fixture for Better Auth integration tests. */
export const MINIMAL_AUTH_FIXTURE_GUARDIAN_ID = DEV_AUTH_GUARDIAN_ACCOUNTS[0].guardianId

export const SEED_ACADEMIC_PERIODS = [
  { id: '2025-t1', name: 'Trimestre 1', startDate: '2025-09-01', endDate: '2025-12-19' },
  { id: '2025-t2', name: 'Trimestre 2', startDate: '2026-01-05', endDate: '2026-04-03' },
  { id: '2025-t3', name: 'Trimestre 3', startDate: '2026-04-20', endDate: '2026-07-03' },
] as const

/**
 * Daily time-slot grid for the school year (API `period-definitions`).
 * Not the trimester labels in mock `periodDefinitions[]` — those map to `academic-periods`.
 * Times align with planning sessions in `school.ts` (08:30, 09:00, 10:00, 11:00, 14:00…).
 */
export const SEED_PERIOD_DEFINITIONS = [
  { id: 'pd-1', label: 'Période 1', order: 1, startTime: '08:00', endTime: '08:45', isBreak: false },
  { id: 'pd-2', label: 'Période 2', order: 2, startTime: '08:45', endTime: '09:30', isBreak: false },
  { id: 'pd-break-am', label: 'Récréation', order: 3, startTime: '09:30', endTime: '09:45', isBreak: true },
  { id: 'pd-3', label: 'Période 3', order: 4, startTime: '09:45', endTime: '10:30', isBreak: false },
  { id: 'pd-4', label: 'Période 4', order: 5, startTime: '10:30', endTime: '11:15', isBreak: false },
  { id: 'pd-5', label: 'Période 5', order: 6, startTime: '11:15', endTime: '12:00', isBreak: false },
  { id: 'pd-lunch', label: 'Pause déjeuner', order: 7, startTime: '12:00', endTime: '13:30', isBreak: true },
  { id: 'pd-6', label: 'Période 6', order: 8, startTime: '13:30', endTime: '14:15', isBreak: false },
  { id: 'pd-7', label: 'Période 7', order: 9, startTime: '14:15', endTime: '15:00', isBreak: false },
  { id: 'pd-break-pm', label: 'Récréation', order: 10, startTime: '15:00', endTime: '15:15', isBreak: true },
  { id: 'pd-8', label: 'Période 8', order: 11, startTime: '15:15', endTime: '16:00', isBreak: false },
] as const

export function splitDisplayName(fullName: string): { firstName: string, lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? 'Unknown', lastName: parts[0] ?? 'Unknown' }
  }
  return { firstName: parts[0] ?? 'Unknown', lastName: parts.slice(1).join(' ') }
}

export function parseSeedDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`)
}
