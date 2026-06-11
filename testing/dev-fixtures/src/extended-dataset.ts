/** Additional mock data from `school.ts` / `report-cards.ts` not yet in base `dataset.ts`. */

export const SEED_EXTENDED_CLASSES = [
  { id: '4a', gradeLevelId: 'gl-4', name: '4th — A', capacity: 30 },
  { id: '3a', gradeLevelId: 'gl-3', name: '3rd — A', capacity: 30 },
  { id: '2nd', gradeLevelId: 'gl-2', name: '2nd', capacity: 30 },
  { id: '1st-s', gradeLevelId: 'gl-1', name: '1st — Science', capacity: 30 },
  { id: 'term-s', gradeLevelId: 'gl-t', name: 'Terminale — S', capacity: 30 },
] as const

export const SEED_EXTENDED_STUDENTS = [
  { id: 's9', classId: 'term-s', name: 'Eliot Vasseur', birthDate: '2008-09-02' },
  { id: 's10', classId: 'term-s', name: 'Nina Bouchard', birthDate: '2008-04-19' },
  { id: 's11', classId: '5a', name: 'Aminata Diallo', birthDate: '2013-06-15' },
  { id: 's12', classId: '4a', name: 'Moussa Diallo', birthDate: '2012-03-08' },
  { id: 's13', classId: '3a', name: 'Khadija Diallo', birthDate: '2011-09-22' },
] as const

export const SEED_EXTENDED_GUARDIANS = [
  {
    id: 'g7',
    name: 'Sylvie Bouchard',
    email: 's.bouchard@mail.com',
    phone: '+33 6 99 88 77 66',
    studentIds: ['s10'],
    relationship: 'mother',
  },
  {
    id: 'g8',
    name: 'Fatou Diallo',
    email: 'f.diallo@mail.com',
    phone: '+33 6 33 44 55 66',
    studentIds: ['s11', 's12', 's13'],
    relationship: 'mother',
  },
] as const

export const SEED_EXTENDED_SUBJECT_CATALOG = [
  { id: 'subj-advmath', code: 'ADVMATH', name: 'Advanced Mathematics', defaultCoefficient: 3 },
  { id: 'subj-phys', code: 'PHYS', name: 'Physics & Chemistry', defaultCoefficient: 3 },
] as const

export const SEED_EXTENDED_SUBJECT_MATTERS = [
  {
    id: 'sm-advmath',
    subjectId: 'subj-advmath',
    name: 'Core programme',
    description: 'Calculus, linear algebra and probability.',
    sequenceOrder: 1,
    estimatedHours: 8,
  },
  {
    id: 'sm-phys',
    subjectId: 'subj-phys',
    name: 'Core programme',
    description: 'Mechanics, electromagnetism, organic chemistry.',
    sequenceOrder: 1,
    estimatedHours: 6,
  },
] as const

export const SEED_EXTENDED_CLASS_SUBJECTS = [
  { id: 'cs-term-advmath', classGroupId: 'term-s', subjectId: 'subj-advmath', coefficient: 3, teacherId: 'st4' },
  { id: 'cs-term-phys', classGroupId: 'term-s', subjectId: 'subj-phys', coefficient: 3, teacherId: 'st4' },
] as const

export const SEED_EXTENDED_ASSESSMENTS = [
  { id: 'e5', classGroupId: 'term-s', classSubjectId: 'cs-term-advmath', title: 'Calculus test', date: '2026-04-20', coefficient: 3, maxScore: 20, kind: 'other' as const },
  { id: 'e5b', classGroupId: 'term-s', classSubjectId: 'cs-term-advmath', title: 'Linear algebra', date: '2026-03-18', coefficient: 2, maxScore: 20, kind: 'other' as const },
  { id: 'e5c', classGroupId: 'term-s', classSubjectId: 'cs-term-advmath', title: 'Mock exam', date: '2026-05-10', coefficient: 4, maxScore: 20, kind: 'other' as const },
] as const

export const SEED_EXTENDED_ASSESSMENT_RESULT_SCORES: Record<string, Partial<Record<'s9' | 's10', number>>> = {
  e5: { s9: 15, s10: 17 },
  e5b: { s9: 14, s10: 16 },
  e5c: { s9: 13, s10: 15 },
}

export const SEED_EXTENDED_STUDENT_FEES = [
  { id: 'b7', studentId: 's9', feeId: 'f2', total: 5600, dueDate: '2026-05-30' },
  { id: 'b8', studentId: 's10', feeId: 'f2', total: 5600, dueDate: '2026-05-30' },
] as const

export const SEED_EXTENDED_PAYMENTS = [
  { id: 'pay-b7-1', studentFeeId: 'b7', amount: 5600, paymentDate: '2025-09-15' },
  { id: 'pay-b8-1', studentFeeId: 'b8', amount: 2800, paymentDate: '2025-09-15' },
] as const

export const SEED_EXTENDED_AUTH_GUARDIANS = [
  { guardianId: 'g7', email: 's.bouchard@mail.com', name: 'Sylvie Bouchard' },
  { guardianId: 'g8', email: 'f.diallo@mail.com', name: 'Fatou Diallo' },
] as const
