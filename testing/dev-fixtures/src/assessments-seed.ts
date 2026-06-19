import { SEED_EXTENDED_ASSESSMENT_RESULT_SCORES, SEED_EXTENDED_ASSESSMENTS } from './extended-dataset'
import { SEED_CLASS_STUDENT_IDS } from './population-seed'

export type SeedAssessmentKind = 'quiz' | 'other' | 'project' | 'homework'

export interface SeedAssessment {
  id: string
  classGroupId: string
  classSubjectId: string
  title: string
  date: string
  coefficient: number
  maxScore: number
  kind: SeedAssessmentKind
}

const STUDENTS_6A = SEED_CLASS_STUDENT_IDS['6a']
const STUDENTS_6B = SEED_CLASS_STUDENT_IDS['6b']
const STUDENTS_5A = SEED_CLASS_STUDENT_IDS['5a']
const STUDENTS_4A = SEED_CLASS_STUDENT_IDS['4a']
const STUDENTS_3A = SEED_CLASS_STUDENT_IDS['3a']
const STUDENTS_2ND = SEED_CLASS_STUDENT_IDS['2nd']
const STUDENTS_1ST_S = SEED_CLASS_STUDENT_IDS['1st-s']
const STUDENTS_TERM_S = SEED_CLASS_STUDENT_IDS['term-s']

export function studentScores(
  studentIds: readonly string[],
  baseScore: number,
  spread = 3,
): Record<string, number> {
  return Object.fromEntries(
    studentIds.map((id, index) => [id, Math.min(20, Math.max(0, baseScore + (index % spread) - 1))]),
  )
}

/** Class 6a assessments — trimesters 2 and 3 (legacy mock evaluations). */
export const SEED_ASSESSMENTS_6A_T2_T3: readonly SeedAssessment[] = [
  { id: 'e1', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Algebra mid-term', date: '2026-04-12', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e1b', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Geometry quiz', date: '2026-03-15', coefficient: 1, maxScore: 20, kind: 'quiz' },
  { id: 'e1c', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Mental arithmetic', date: '2026-02-20', coefficient: 1, maxScore: 20, kind: 'quiz' },
  { id: 'e1d', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Problem solving', date: '2026-05-05', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e2', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Essay — La Fontaine', date: '2026-04-18', coefficient: 1, maxScore: 20, kind: 'other' },
  { id: 'e2b', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Dictée', date: '2026-03-22', coefficient: 1, maxScore: 20, kind: 'quiz' },
  { id: 'e2c', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Oral presentation', date: '2026-02-28', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e3', classGroupId: '6a', classSubjectId: 'cs-6a-hist', title: 'Map quiz', date: '2026-04-25', coefficient: 1, maxScore: 20, kind: 'quiz' },
  { id: 'e3b', classGroupId: '6a', classSubjectId: 'cs-6a-hist', title: 'Antiquity test', date: '2026-03-10', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e4', classGroupId: '6a', classSubjectId: 'cs-6a-sci', title: 'Lab report', date: '2026-05-02', coefficient: 2, maxScore: 20, kind: 'project' },
  { id: 'e4b', classGroupId: '6a', classSubjectId: 'cs-6a-sci', title: 'Ecosystems quiz', date: '2026-03-28', coefficient: 1, maxScore: 20, kind: 'quiz' },
]

/** Class 6a — trimestre 1. */
export const SEED_ASSESSMENTS_6A_T1: readonly SeedAssessment[] = [
  { id: 'e1-t1-math', classGroupId: '6a', classSubjectId: 'cs-6a-math', title: 'Numbers & operations test', date: '2025-11-15', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e1-t1-fr', classGroupId: '6a', classSubjectId: 'cs-6a-fr', title: 'Reading comprehension', date: '2025-12-05', coefficient: 1, maxScore: 20, kind: 'other' },
  { id: 'e1-t1-hist', classGroupId: '6a', classSubjectId: 'cs-6a-hist', title: 'Ancient civilizations quiz', date: '2025-10-22', coefficient: 1, maxScore: 20, kind: 'quiz' },
  { id: 'e1-t1-sci', classGroupId: '6a', classSubjectId: 'cs-6a-sci', title: 'Living world assessment', date: '2025-11-28', coefficient: 2, maxScore: 20, kind: 'other' },
]

function classTrimesterAssessments(
  classGroupId: string,
  prefix: string,
  mathCs: string,
  frCs: string,
  students: readonly string[],
): { assessments: SeedAssessment[], scores: Record<string, Record<string, number>> } {
  const assessments: SeedAssessment[] = [
    { id: `${prefix}-t1-math`, classGroupId, classSubjectId: mathCs, title: 'Autumn maths test', date: '2025-11-20', coefficient: 2, maxScore: 20, kind: 'other' },
    { id: `${prefix}-t1-fr`, classGroupId, classSubjectId: frCs, title: 'Autumn French test', date: '2025-12-10', coefficient: 1, maxScore: 20, kind: 'other' },
    { id: `${prefix}-t2-math`, classGroupId, classSubjectId: mathCs, title: 'Winter maths test', date: '2026-02-18', coefficient: 2, maxScore: 20, kind: 'other' },
    { id: `${prefix}-t2-fr`, classGroupId, classSubjectId: frCs, title: 'Winter French test', date: '2026-03-12', coefficient: 1, maxScore: 20, kind: 'other' },
    { id: `${prefix}-t3-math`, classGroupId, classSubjectId: mathCs, title: 'Spring maths test', date: '2026-05-08', coefficient: 2, maxScore: 20, kind: 'other' },
    { id: `${prefix}-t3-fr`, classGroupId, classSubjectId: frCs, title: 'Spring French test', date: '2026-06-02', coefficient: 1, maxScore: 20, kind: 'other' },
  ]
  const scores: Record<string, Record<string, number>> = {}
  for (const assessment of assessments) {
    scores[assessment.id] = studentScores(students, 13)
  }
  return { assessments, scores }
}

const SEED_6B = classTrimesterAssessments('6b', 'e6b', 'cs-6b-math', 'cs-6b-fr', STUDENTS_6B)
const SEED_5A = classTrimesterAssessments('5a', 'e5a', 'cs-5a-math', 'cs-5a-fr', STUDENTS_5A)
const SEED_2ND = classTrimesterAssessments('2nd', 'e2nd', 'cs-2nd-math', 'cs-2nd-fr', STUDENTS_2ND)
const SEED_1ST_S = classTrimesterAssessments('1st-s', 'e1st', 'cs-1st-math', 'cs-1st-fr', STUDENTS_1ST_S)

/** Light coverage — one maths assessment per trimester for upper middle school classes. */
export const SEED_ASSESSMENTS_EXTENDED_LIGHT: readonly SeedAssessment[] = [
  { id: 'e4a-t1-math', classGroupId: '4a', classSubjectId: 'cs-4a-math', title: 'Fractions quiz', date: '2025-11-18', coefficient: 1, maxScore: 20, kind: 'quiz' },
  { id: 'e4a-t2-math', classGroupId: '4a', classSubjectId: 'cs-4a-math', title: 'Equations test', date: '2026-02-25', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e4a-t3-math', classGroupId: '4a', classSubjectId: 'cs-4a-math', title: 'Geometry test', date: '2026-05-12', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e3a-t1-math', classGroupId: '3a', classSubjectId: 'cs-3a-math', title: 'Functions intro', date: '2025-12-02', coefficient: 1, maxScore: 20, kind: 'quiz' },
  { id: 'e3a-t2-math', classGroupId: '3a', classSubjectId: 'cs-3a-math', title: 'Linear functions', date: '2026-03-05', coefficient: 2, maxScore: 20, kind: 'other' },
  { id: 'e3a-t3-math', classGroupId: '3a', classSubjectId: 'cs-3a-math', title: 'Brevet mock', date: '2026-05-20', coefficient: 3, maxScore: 20, kind: 'other' },
]

export const SEED_ASSESSMENTS: readonly SeedAssessment[] = [
  ...SEED_ASSESSMENTS_6A_T1,
  ...SEED_ASSESSMENTS_6A_T2_T3,
  ...SEED_6B.assessments,
  ...SEED_5A.assessments,
  ...SEED_2ND.assessments,
  ...SEED_1ST_S.assessments,
  ...SEED_ASSESSMENTS_EXTENDED_LIGHT,
  ...SEED_EXTENDED_ASSESSMENTS,
]

const SEED_ASSESSMENT_RESULT_SCORES_6A: Record<string, Partial<Record<string, number>>> = {
  'e1-t1-math': studentScores(STUDENTS_6A, 14),
  'e1-t1-fr': studentScores(STUDENTS_6A, 13),
  'e1-t1-hist': studentScores(STUDENTS_6A, 12),
  'e1-t1-sci': studentScores(STUDENTS_6A, 14),
  'e1': { s1: 15, s2: 13, s3: 14, s4: 16, s5: 14, s6: 13 },
  'e1b': { s1: 14, s2: 12, s3: 13, s4: 15, s5: 13, s6: 12 },
  'e1c': { s1: 16, s2: 15, s3: 16, s4: 15, s5: 17, s6: 14 },
  'e1d': { s1: 13, s2: 11, s3: 12, s4: 14, s5: 13, s6: 13 },
  'e2': { s1: 13, s2: 12, s3: 14, s4: 13, s5: 12 },
  'e2b': { s1: 12, s2: 10, s3: 11, s4: 13, s5: 12, s6: 11 },
  'e2c': { s1: 15, s2: 14, s3: 14, s4: 15, s5: 13, s6: 13 },
  'e3': {},
  'e3b': { s1: 14, s2: 13, s3: 15, s4: 13, s5: 14, s6: 12 },
  'e4': {},
  'e4b': { s1: 14, s2: 15, s3: 13, s4: 14, s5: 15, s6: 14 },
  'e4a-t1-math': studentScores(STUDENTS_4A, 12),
  'e4a-t2-math': studentScores(STUDENTS_4A, 13),
  'e4a-t3-math': studentScores(STUDENTS_4A, 14),
  'e3a-t1-math': studentScores(STUDENTS_3A, 11),
  'e3a-t2-math': studentScores(STUDENTS_3A, 12),
  'e3a-t3-math': studentScores(STUDENTS_3A, 13),
}

export const SEED_ASSESSMENT_RESULT_SCORES: Record<string, Partial<Record<string, number>>> = {
  ...SEED_ASSESSMENT_RESULT_SCORES_6A,
  ...SEED_6B.scores,
  ...SEED_5A.scores,
  ...SEED_2ND.scores,
  ...SEED_1ST_S.scores,
  ...Object.fromEntries(
    Object.keys(SEED_EXTENDED_ASSESSMENT_RESULT_SCORES).map(assessmentId => [
      assessmentId,
      studentScores(STUDENTS_TERM_S, 14, 4),
    ]),
  ),
}

export function countSeedAssessments(): number {
  return SEED_ASSESSMENTS.length
}

export function countSeedAssessmentResults(): number {
  return Object.values(SEED_ASSESSMENT_RESULT_SCORES)
    .reduce((total, scores) => total + Object.keys(scores).length, 0)
}
