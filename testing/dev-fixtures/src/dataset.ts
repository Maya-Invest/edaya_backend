/**
 * Shared dev fixture IDs and records for API seeding, integration tests, and webapp mock migration.
 * Canonical source — align `apps/webapp/src/lib/data/school.ts` with this package over time.
 */

import {
  SEED_EXTENDED_ASSESSMENT_RESULT_SCORES,
  SEED_EXTENDED_ASSESSMENTS,
  SEED_EXTENDED_AUTH_GUARDIANS,
  SEED_EXTENDED_CLASS_SUBJECTS,
  SEED_EXTENDED_CLASSES,
  SEED_EXTENDED_GUARDIANS,
  SEED_EXTENDED_PAYMENTS,
  SEED_EXTENDED_STUDENT_FEES,
  SEED_EXTENDED_STUDENTS,
  SEED_EXTENDED_SUBJECT_CATALOG,
  SEED_EXTENDED_SUBJECT_MATTERS,
} from './extended-dataset'

export const SEED_SCHOOL_ID = 'sch-edaya-central'

export const SEED_SCHOOL_PROFILE = {
  id: SEED_SCHOOL_ID,
  name: 'EDAYA — Campus Central',
  timeZone: 'Europe/Paris',
  city: 'Paris',
  country: 'FR',
} as const

export const SEED_SCHOOL_NORD_ID = 'sch-edaya-nord'

export const SEED_SCHOOL_NORD_PROFILE = {
  id: SEED_SCHOOL_NORD_ID,
  name: 'EDAYA — Campus Nord',
  timeZone: 'Europe/Paris',
  city: 'Lille',
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
  ...SEED_EXTENDED_CLASSES,
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

/** Staff member id designated as school owner in dev fixtures (Camille Moreau / st5). */
export const SEED_SCHOOL_OWNER_STAFF_ID = SEED_STAFF[0].id

export const SEED_STUDENTS = [
  { id: 's1', classId: '6a', name: 'Amélie Laurent', birthDate: '2014-03-12' },
  { id: 's2', classId: '6a', name: 'Noah Bennett', birthDate: '2014-07-22' },
  { id: 's3', classId: '6a', name: 'Mira Okafor', birthDate: '2014-01-09' },
  { id: 's4', classId: '6a', name: 'Theo Marchetti', birthDate: '2014-05-30' },
  { id: 's5', classId: '6a', name: 'Yuki Tanaka', birthDate: '2014-11-04' },
  { id: 's6', classId: '6a', name: 'Sofia Reyes', birthDate: '2014-08-17' },
  { id: 's7', classId: '6b', name: 'Liam Foster', birthDate: '2014-02-21' },
  { id: 's8', classId: '6b', name: 'Zara Khan', birthDate: '2014-06-11' },
  ...SEED_EXTENDED_STUDENTS,
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
  ...SEED_EXTENDED_GUARDIANS,
] as const

/** School-wide subject catalog aligned with the webapp school mock data. */
export const SEED_SUBJECT_CATALOG = [
  { id: 'subj-math', code: 'MATH', name: 'Mathematics', defaultCoefficient: 3, category: 'Scientifique', color: 'mint' },
  { id: 'subj-fr', code: 'FR', name: 'French Literature', defaultCoefficient: 2, category: 'Littéraire', color: 'warm' },
  { id: 'subj-hist', code: 'HIST', name: 'History & Geography', defaultCoefficient: 2, category: 'Sciences humaines', color: 'sky' },
  { id: 'subj-sci', code: 'SCI', name: 'Natural Sciences', defaultCoefficient: 2, category: 'Scientifique', color: 'warm' },
  { id: 'subj-en', code: 'EN', name: 'English', defaultCoefficient: 2, category: 'Langues', color: 'sky' },
  { id: 'subj-eps', code: 'EPS', name: 'Physical Education', defaultCoefficient: 1, category: 'Sport', color: 'mint' },
  ...SEED_EXTENDED_SUBJECT_CATALOG,
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
  ...SEED_EXTENDED_SUBJECT_MATTERS,
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
  { id: 'cs-5a-math', classGroupId: '5a', subjectId: 'subj-math', coefficient: 3, teacherId: 'st1' },
  { id: 'cs-5a-fr', classGroupId: '5a', subjectId: 'subj-fr', coefficient: 2, teacherId: 'st2' },
  { id: 'cs-5a-hist', classGroupId: '5a', subjectId: 'subj-hist', coefficient: 2, teacherId: 'st3' },
  { id: 'cs-5a-sci', classGroupId: '5a', subjectId: 'subj-sci', coefficient: 2, teacherId: 'st1' },
  { id: 'cs-5a-en', classGroupId: '5a', subjectId: 'subj-en', coefficient: 2, teacherId: 'st7' },
  { id: 'cs-5a-eps', classGroupId: '5a', subjectId: 'subj-eps', coefficient: 1, teacherId: 'st7' },
  ...SEED_EXTENDED_CLASS_SUBJECTS,
] as const

const SEED_SUBJECT_MATTER_BY_SUBJECT_ID: Record<string, string> = {
  'subj-math': 'sm-math',
  'subj-fr': 'sm-fr',
  'subj-hist': 'sm-hist',
  'subj-sci': 'sm-sci',
  'subj-en': 'sm-en',
  'subj-eps': 'sm-eps',
  'subj-advmath': 'sm-advmath',
  'subj-phys': 'sm-phys',
}

/** Links programme matters to class offerings for teaching progress tracking. */
export const SEED_CLASS_SUBJECT_MATTERS = SEED_CLASS_SUBJECTS.map(offering => ({
  id: `csm-${offering.id}`,
  classSubjectId: offering.id,
  subjectMatterId: SEED_SUBJECT_MATTER_BY_SUBJECT_ID[offering.subjectId]!,
}))

/** Physical resources from mock `resources[]`. UI-only `status` / `location` are not persisted. */
export const SEED_RESOURCES = [
  { id: 'r1', name: 'Auditorium', kind: 'location' as const, capacity: 220, description: 'Building A · GF' },
  { id: 'r2', name: 'Lab — Chemistry 2', kind: 'location' as const, capacity: 24, description: 'Building B · 2F' },
  { id: 'r3', name: 'Gymnasium', kind: 'location' as const, capacity: 120, description: 'Annex' },
  { id: 'r4', name: 'Mobile tablet cart', kind: 'equipment' as const, capacity: 30, description: 'IT office' },
  { id: 'r5', name: 'School bus #2', kind: 'vehicle' as const, capacity: 48, description: 'Garage' },
  { id: 'r6', name: 'Library — Reading hall', kind: 'location' as const, capacity: 60, description: 'Building C · 1F' },
  { id: 'r7', name: '3D printer', kind: 'equipment' as const, description: 'Lab — Physics' },
] as const

/** Reference Monday for concrete timetable sessions (week aligned with mock planning). */
export const SEED_PLANNING_REFERENCE_WEEK_START = '2026-05-11'

const PLANNING_DAY_OFFSET = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
} as const

/** Weekly timetable slots for class 6a from mock `planning[]`. */
export const SEED_PLANNING_SLOTS = [
  { id: 'p1', scheduleId: 'sch-p1', sessionId: 'sess-p1', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Algebra basics', day: 'Mon', startTime: '08:30', endTime: '09:30', teacherId: 'st1' },
  { id: 'p2', scheduleId: 'sch-p2', sessionId: 'sess-p2', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Reading session', day: 'Mon', startTime: '10:00', endTime: '11:00', teacherId: 'st2' },
  { id: 'p3', scheduleId: 'sch-p3', sessionId: 'sess-p3', classGroupId: '6a', classSubjectId: 'cs-6a-hist', title: 'Ancient Greece', day: 'Tue', startTime: '09:00', endTime: '10:00', teacherId: 'st3' },
  { id: 'p4', scheduleId: 'sch-p4', sessionId: 'sess-p4', classGroupId: '6a', classSubjectId: 'cs-6a-sci', title: 'Lab — Cells', day: 'Wed', startTime: '08:30', endTime: '10:30', teacherId: 'st1', resourceId: 'r2' },
  { id: 'p5', scheduleId: 'sch-p5', sessionId: 'sess-p5', classGroupId: '6a', classSubjectId: 'cs-6a-en', title: 'Conversation', day: 'Thu', startTime: '11:00', endTime: '12:00', teacherId: 'st7' },
  { id: 'p6', scheduleId: 'sch-p6', sessionId: 'sess-p6', classGroupId: '6a', classSubjectId: 'cs-6a-eps', title: 'Athletics', day: 'Fri', startTime: '14:00', endTime: '16:00', teacherId: 'st7', resourceId: 'r3' },
  { id: 'p7', scheduleId: 'sch-p7', sessionId: 'sess-p7', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Geometry workshop', day: 'Thu', startTime: '08:30', endTime: '09:30', teacherId: 'st1' },
  { id: 'p8', scheduleId: 'sch-p8', sessionId: 'sess-p8', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Essay writing', day: 'Wed', startTime: '11:00', endTime: '12:00', teacherId: 'st2' },
] as const

/** Sample teaching progress recorded against the first maths session. */
export const SEED_SESSION_PROGRESS = {
  id: 'csp-p1',
  classSubjectMatterId: 'csm-cs-6a-math',
  sessionId: 'sess-p1',
  completedPercentage: 25,
  notes: 'Introduced algebra basics.',
} as const

/** Class 6a assessments from mock `evaluations[]` (term-s entries excluded). */
/** Coefficients are integers in DB — mock fractions (0.5, 1.5) rounded to nearest whole number. */
export const SEED_ASSESSMENTS = [
  { id: 'e1', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Algebra mid-term', date: '2026-04-12', coefficient: 2, maxScore: 20, kind: 'other' as const },
  { id: 'e1b', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Geometry quiz', date: '2026-03-15', coefficient: 1, maxScore: 20, kind: 'quiz' as const },
  { id: 'e1c', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Mental arithmetic', date: '2026-02-20', coefficient: 1, maxScore: 20, kind: 'quiz' as const },
  { id: 'e1d', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Problem solving', date: '2026-05-05', coefficient: 2, maxScore: 20, kind: 'other' as const },
  { id: 'e2', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Essay — La Fontaine', date: '2026-04-18', coefficient: 1, maxScore: 20, kind: 'other' as const },
  { id: 'e2b', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Dictée', date: '2026-03-22', coefficient: 1, maxScore: 20, kind: 'quiz' as const },
  { id: 'e2c', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Oral presentation', date: '2026-02-28', coefficient: 2, maxScore: 20, kind: 'other' as const },
  { id: 'e3', classGroupId: '6a', classSubjectId: 'cs-6a-hist', title: 'Map quiz', date: '2026-04-25', coefficient: 1, maxScore: 20, kind: 'quiz' as const },
  { id: 'e3b', classGroupId: '6a', classSubjectId: 'cs-6a-hist', title: 'Antiquity test', date: '2026-03-10', coefficient: 2, maxScore: 20, kind: 'other' as const },
  { id: 'e4', classGroupId: '6a', classSubjectId: 'cs-6a-sci', title: 'Lab report', date: '2026-05-02', coefficient: 2, maxScore: 20, kind: 'project' as const },
  { id: 'e4b', classGroupId: '6a', classSubjectId: 'cs-6a-sci', title: 'Ecosystems quiz', date: '2026-03-28', coefficient: 1, maxScore: 20, kind: 'quiz' as const },
  ...SEED_EXTENDED_ASSESSMENTS,
] as const

/** Partial student scores keyed by assessment id — empty means not yet graded. */
export const SEED_ASSESSMENT_RESULT_SCORES: Record<string, Partial<Record<(typeof SEED_STUDENTS)[number]['id'], number>>> = {
  e1: { s1: 15, s2: 13, s3: 14, s4: 16, s5: 14, s6: 13 },
  e1b: { s1: 14, s2: 12, s3: 13, s4: 15, s5: 13, s6: 12 },
  e1c: { s1: 16, s2: 15, s3: 16, s4: 15, s5: 17, s6: 14 },
  e1d: { s1: 13, s2: 11, s3: 12, s4: 14, s5: 13, s6: 13 },
  e2: { s1: 13, s2: 12, s3: 14, s4: 13, s5: 12 },
  e2b: { s1: 12, s2: 10, s3: 11, s4: 13, s5: 12, s6: 11 },
  e2c: { s1: 15, s2: 14, s3: 14, s4: 15, s5: 13, s6: 13 },
  e3: {},
  e3b: { s1: 14, s2: 13, s3: 15, s4: 13, s5: 14, s6: 12 },
  e4: {},
  e4b: { s1: 14, s2: 15, s3: 13, s4: 14, s5: 15, s6: 14 },
  ...SEED_EXTENDED_ASSESSMENT_RESULT_SCORES,
}

/** School calendar from mock `schoolYearEvents[]`. UI `type` / multi-class `scope` mapped at seed time. */
export const SEED_CALENDAR_EVENTS = [
  { id: 'yc1', title: 'Fête du Travail', startDate: '2026-05-01', endDate: '2026-05-01', mockType: 'holiday' as const, description: 'Jour férié national. L\'école est fermée.', scope: 'all' as const },
  { id: 'yc2', title: 'Ascension', startDate: '2026-05-14', endDate: '2026-05-14', mockType: 'holiday' as const, description: 'Jour férié. Pas de cours.', scope: 'all' as const },
  { id: 'yc3', title: 'Vacances de printemps', startDate: '2026-04-20', endDate: '2026-05-02', mockType: 'vacation' as const, description: 'Vacances scolaires de printemps. Réouverture le 4 mai.', scope: 'all' as const },
  { id: 'yc4', title: 'Formation enseignants', startDate: '2026-05-20', endDate: '2026-05-20', mockType: 'closure' as const, description: 'Journée de formation pédagogique. Arrêt de cours pour tous les élèves.', scope: 'all' as const },
  { id: 'yc5', title: 'Réunion parents-professeurs', startDate: '2026-05-15', endDate: '2026-05-15', mockType: 'ceremony' as const, description: 'Réunion de fin de trimestre pour les classes de Middle School.', scope: ['6a', '6b', '5a'] as const },
  { id: 'yc6', title: 'Journée sportive', startDate: '2026-06-05', endDate: '2026-06-05', mockType: 'ceremony' as const, description: 'Compétitions inter-classes et activités sportives en plein air.', scope: 'all' as const },
  { id: 'yc7', title: 'Lundi de Pentecôte', startDate: '2026-05-25', endDate: '2026-05-25', mockType: 'holiday' as const, description: 'Jour férié national. L\'école est fermée.', scope: 'all' as const },
  { id: 'yc8', title: 'Conseil de classe', startDate: '2026-06-12', endDate: '2026-06-12', mockType: 'closure' as const, description: 'Conseil de classe — arrêt des cours à 12h.', scope: 'all' as const },
  { id: 'yc9', title: 'Vacances d\'été', startDate: '2026-07-03', endDate: '2026-07-03', mockType: 'vacation' as const, description: 'Vacances scolaires d\'été. Réouverture le 1er septembre 2026.', scope: 'all' as const },
  { id: 'yc10', title: 'Cérémonie de remise des prix', startDate: '2026-06-26', endDate: '2026-06-26', mockType: 'ceremony' as const, description: 'Cérémonie de fin d\'année et remise des prix au tableau d\'honneur.', scope: 'all' as const },
] as const

/** Discipline incidents from mock `incidents[]` with student involvements. */
export const SEED_INCIDENTS = [
  { id: 'i1', studentId: 's3', classGroupId: '6a', date: '2026-04-12', title: 'Repeated tardiness', description: 'Late to class 3 times this month.', kind: 'minor_infraction' as const, mockCategory: 'Tardiness' as const, mockSeverity: 'low' as const },
  { id: 'i2', studentId: 's2', classGroupId: '6a', date: '2026-03-22', title: 'Class disruption', description: 'Disruption during English class.', kind: 'minor_infraction' as const, mockCategory: 'Behavior' as const, mockSeverity: 'medium' as const },
  { id: 'i3', studentId: 's3', classGroupId: '6a', date: '2026-04-26', title: 'Recess conflict', description: 'Argument with classmate during recess.', kind: 'major_infraction' as const, mockCategory: 'Conflict' as const, mockSeverity: 'medium' as const },
] as const

/** Attendance absences from mock `absences[]` — includes dedicated session slots. */
export const SEED_ABSENCE_RECORDS = [
  { id: 'a1', sessionId: 'sess-abs-a1', classGroupId: '6a', classSubjectId: 'cs-6a-math', studentId: 's1', date: '2026-05-12', startTime: '08:30', endTime: '09:30', reason: 'Maladie' },
  { id: 'a2', sessionId: 'sess-abs-a2', classGroupId: '6a', classSubjectId: 'cs-6a-hist', studentId: 's1', date: '2026-04-28', startTime: '14:00', endTime: '15:00', reason: 'Rendez-vous médical' },
  { id: 'a3', sessionId: 'sess-abs-a3', classGroupId: '6a', classSubjectId: 'cs-6a-en', studentId: 's2', date: '2026-05-05', startTime: '10:15', endTime: '11:15' },
  { id: 'a4', sessionId: 'sess-abs-a4', classGroupId: '6a', classSubjectId: 'cs-6a-sci', studentId: 's3', date: '2026-05-14', startTime: '09:00', endTime: '10:00', reason: 'Non justifiée' },
  { id: 'a5', sessionId: 'sess-abs-a5', classGroupId: '6a', classSubjectId: 'cs-6a-sci', studentId: 's3', date: '2026-04-22', startTime: '13:30', endTime: '14:30', reason: 'Maladie' },
  { id: 'a6', sessionId: 'sess-abs-a6', classGroupId: '6a', classSubjectId: 'cs-6a-eps', studentId: 's3', date: '2026-03-18', startTime: '16:00', endTime: '17:00' },
  { id: 'a7', sessionId: 'sess-abs-a7', classGroupId: '6a', classSubjectId: 'cs-6a-fr', studentId: 's4', date: '2026-05-02', startTime: '11:00', endTime: '12:00', reason: 'Famille' },
  { id: 'a8', sessionId: 'sess-abs-a8', classGroupId: '6a', classSubjectId: 'cs-6a-math', studentId: 's6', date: '2026-04-15', startTime: '08:30', endTime: '09:30' },
] as const

/** Student health profiles from mock `healthRecords`. */
export const SEED_STUDENT_HEALTH_PROFILES = [
  { id: 'hp-s1', studentId: 's1', bloodType: 'A+', allergies: ['Pollen'] as const, medications: [] as const, chronicConditions: ['Asthme'] as const, lastVisit: '2026-02-14', notes: 'Mild seasonal allergies.' },
  { id: 'hp-s3', studentId: 's3', bloodType: 'O-', allergies: ['Peanuts', 'Shellfish'] as const, medications: ['EpiPen'] as const, chronicConditions: ['Asthme', 'Epilepsie'] as const, lastVisit: '2026-04-08', notes: 'Severe peanut allergy. EpiPen in nurse\'s office.' },
  { id: 'hp-s5', studentId: 's5', bloodType: 'B+', allergies: [] as const, medications: [] as const, chronicConditions: [] as const, lastVisit: '2025-11-22', notes: 'No known issues.' },
] as const

/** Pedagogical notes from mock `pedagogicalNotes[]`. UI `category` stored in note title at seed time. */
export const SEED_PEDAGOGICAL_NOTES = [
  { id: 'pn1', studentId: 's1', date: '2026-05-12', authorId: 'st1', category: 'Progression' as const, content: 'Très bonne progression en algèbre, raisonnement clair.' },
  { id: 'pn2', studentId: 's1', date: '2026-04-22', authorId: 'st2', category: 'Travail' as const, content: 'Travail écrit soigné, à approfondir l\'argumentation.' },
  { id: 'pn3', studentId: 's1', date: '2026-03-15', authorId: 'st3', category: 'Encouragement' as const, content: 'Participation orale en hausse, continuer ainsi.' },
  { id: 'pn4', studentId: 's2', date: '2026-05-05', authorId: 'st1', category: 'Comportement' as const, content: 'Bavardages réguliers en classe, vigilance demandée.' },
  { id: 'pn5', studentId: 's2', date: '2026-04-10', authorId: 'st2', category: 'Travail' as const, content: 'Devoirs rendus en retard à deux reprises.' },
  { id: 'pn6', studentId: 's3', date: '2026-05-18', authorId: 'st3', category: 'Progression' as const, content: 'Compréhension solide en histoire, bon esprit de synthèse.' },
  { id: 'pn7', studentId: 's3', date: '2026-04-02', authorId: 'st1', category: 'Encouragement' as const, content: 'Excellent investissement sur le projet de groupe.' },
] as const

/** Shared dev password for seeded Better Auth accounts. Dev-only — never use in production. */
export const DEV_AUTH_PASSWORD = 'DevPassword1!'

/** Staff accounts provisioned and linked during dev auth seed. */
export const DEV_AUTH_STAFF_ACCOUNTS = [
  { staffId: 'st5', email: 'c.moreau@school.edu', name: 'Camille Moreau' },
  { staffId: 'st1', email: 'm.dupont@school.edu', name: 'Mme Dupont' },
  { staffId: 'st2', email: 'm.garnier@school.edu', name: 'M. Garnier' },
  { staffId: 'st3', email: 'm.leon@school.edu', name: 'Mme Léon' },
  { staffId: 'st7', email: 't.evrard@school.edu', name: 'Tom Évrard' },
] as const

/** Access role ids for auth-linked staff — keep in sync with access seed. */
export const DEV_AUTH_STAFF_ACCESS_ROLE_IDS: Record<
  (typeof DEV_AUTH_STAFF_ACCOUNTS)[number]['staffId'],
  string
> = {
  st5: 'role-director',
  st1: 'role-teacher',
  st2: 'role-teacher',
  st3: 'role-coordinator',
  st7: 'role-educator',
}

/** Guardian accounts provisioned and linked during dev auth seed. */
export const DEV_AUTH_GUARDIAN_ACCOUNTS = [
  { guardianId: 'g1', email: 'c.laurent@mail.com', name: 'Claire Laurent' },
  { guardianId: 'g2', email: 'j.bennett@mail.com', name: 'James Bennett' },
  { guardianId: 'g3', email: 'a.okafor@mail.com', name: 'Adaeze Okafor' },
  { guardianId: 'g4', email: 'l.marchetti@mail.com', name: 'Luca Marchetti' },
  { guardianId: 'g5', email: 'h.tanaka@mail.com', name: 'Hana Tanaka' },
  { guardianId: 'g6', email: 'm.reyes@mail.com', name: 'Marco Reyes' },
  ...SEED_EXTENDED_AUTH_GUARDIANS,
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

/** Currency for seeded fee and payment amounts (Paris campus). */
export const SEED_CURRENCY = 'EUR'

/** Reference date used when deriving fee status during dev finance seed. */
export const SEED_FINANCE_REFERENCE_DATE = '2026-05-15'

const SEED_FEE_YEARLY_INSTALLMENTS = [
  { label: 'September', percentage: 33.33, dueDate: '2025-09-15' },
  { label: 'January', percentage: 33.33, dueDate: '2026-01-15' },
  { label: 'May', percentage: 33.34, dueDate: '2026-05-15' },
] as const

/** School fee catalog from `apps/webapp/src/lib/data/school.ts` `fees[]`. */
export const SEED_FEES = [
  {
    id: 'f1',
    name: 'Tuition — Middle School',
    category: 'tuition' as const,
    defaultAmount: 4800,
    installments: SEED_FEE_YEARLY_INSTALLMENTS,
  },
  {
    id: 'f2',
    name: 'Tuition — High School',
    category: 'tuition' as const,
    defaultAmount: 5600,
    installments: SEED_FEE_YEARLY_INSTALLMENTS,
  },
  {
    id: 'f3',
    name: 'School bus',
    category: 'transport' as const,
    defaultAmount: 720,
    installments: [{ label: 'Annual', percentage: 100, dueDate: '2025-09-15' }],
  },
  {
    id: 'f4',
    name: 'Cafeteria plan',
    category: 'other' as const,
    defaultAmount: 180,
    installments: [] as const,
  },
  {
    id: 'f5',
    name: 'Sports club',
    category: 'other' as const,
    defaultAmount: 240,
    installments: [{ label: 'Term', percentage: 100, dueDate: '2026-01-15' }],
  },
  {
    id: 'f6',
    name: 'Textbook pack',
    category: 'other' as const,
    defaultAmount: 160,
    installments: [{ label: 'Annual', percentage: 100, dueDate: '2025-09-15' }],
  },
] as const

/**
 * Student billing lines from mock `billing[]`.
 * UI-only mock fields (`status`) are derived by payment workflow, not stored here.
 */
export const SEED_STUDENT_FEES = [
  { id: 'b1', studentId: 's1', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b2', studentId: 's2', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b3', studentId: 's3', feeId: 'f1', total: 4800, dueDate: '2026-04-15' },
  { id: 'b4', studentId: 's4', feeId: 'f3', total: 720, dueDate: '2025-09-30' },
  { id: 'b5', studentId: 's5', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b6', studentId: 's6', feeId: 'f4', total: 1620, dueDate: '2026-06-01' },
  ...SEED_EXTENDED_STUDENT_FEES,
] as const

/** Paid installments from mock `billing[]` — replayed via `recordPayment`. */
export const SEED_PAYMENTS = [
  { id: 'pay-b1-1', studentFeeId: 'b1', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b1-2', studentFeeId: 'b1', amount: 1600, paymentDate: '2026-01-15' },
  { id: 'pay-b1-3', studentFeeId: 'b1', amount: 1600, paymentDate: '2026-05-15' },
  { id: 'pay-b2-1', studentFeeId: 'b2', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b2-2', studentFeeId: 'b2', amount: 1600, paymentDate: '2026-01-15' },
  { id: 'pay-b3-1', studentFeeId: 'b3', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b4-1', studentFeeId: 'b4', amount: 720, paymentDate: '2025-09-15' },
  { id: 'pay-b5-1', studentFeeId: 'b5', amount: 4800, paymentDate: '2025-09-15' },
  { id: 'pay-b6-1', studentFeeId: 'b6', amount: 180, paymentDate: '2025-10-01' },
  { id: 'pay-b6-2', studentFeeId: 'b6', amount: 180, paymentDate: '2025-11-01' },
  { id: 'pay-b6-3', studentFeeId: 'b6', amount: 180, paymentDate: '2025-12-01' },
  { id: 'pay-b6-4', studentFeeId: 'b6', amount: 180, paymentDate: '2026-01-01' },
  { id: 'pay-b6-5', studentFeeId: 'b6', amount: 180, paymentDate: '2026-02-01' },
  ...SEED_EXTENDED_PAYMENTS,
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

export function parseSeedDateTime(isoDate: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number)
  const date = parseSeedDate(isoDate)
  date.setUTCHours(hours ?? 0, minutes ?? 0, 0, 0)
  return date
}

export function planningSessionDate(day: keyof typeof PLANNING_DAY_OFFSET): string {
  const base = parseSeedDate(SEED_PLANNING_REFERENCE_WEEK_START)
  base.setUTCDate(base.getUTCDate() + PLANNING_DAY_OFFSET[day])
  return base.toISOString().slice(0, 10)
}

/** Maps an assessment date to the containing academic period id. */
export function seedPeriodIdForDate(isoDate: string): (typeof SEED_ACADEMIC_PERIODS)[number]['id'] {
  const date = parseSeedDate(isoDate)
  if (date <= parseSeedDate('2025-12-19')) {
    return '2025-t1'
  }
  if (date <= parseSeedDate('2026-04-03')) {
    return '2025-t2'
  }
  return '2025-t3'
}
