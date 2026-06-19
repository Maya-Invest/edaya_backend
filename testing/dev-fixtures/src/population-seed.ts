/**
 * Phase 4 population expansion — brings dev fixtures to ~30 students with guardians,
 * class offerings, and light finance across all class groups.
 */

export interface SeedPopulationStudent {
  id: string
  classId: string
  name: string
  birthDate: string
}

export interface SeedPopulationGuardian {
  id: string
  name: string
  email: string
  phone: string
  studentIds: readonly string[]
  relationship: string
}

export interface SeedPopulationClassSubject {
  id: string
  classGroupId: string
  subjectId: string
  coefficient: number
  teacherId: string
}

/** Additional students s14–s30 (17 records) — combined with base + extended = 30 total. */
export const SEED_POPULATION_STUDENTS: readonly SeedPopulationStudent[] = [
  { id: 's14', classId: '6b', name: 'Inès Martin', birthDate: '2014-04-03' },
  { id: 's15', classId: '6b', name: 'Lucas Martin', birthDate: '2014-04-03' },
  { id: 's16', classId: '6b', name: 'Emma Dubois', birthDate: '2014-09-14' },
  { id: 's17', classId: '5a', name: 'Hugo Petit', birthDate: '2013-01-27' },
  { id: 's18', classId: '5a', name: 'Chloé Roux', birthDate: '2013-08-09' },
  { id: 's19', classId: '4a', name: 'Adam Diallo', birthDate: '2012-07-19' },
  { id: 's20', classId: '4a', name: 'Salma Diallo', birthDate: '2012-11-02' },
  { id: 's21', classId: '3a', name: 'Rayan Benali', birthDate: '2011-05-16' },
  { id: 's22', classId: '2nd', name: 'Julie Fontaine', birthDate: '2010-03-21' },
  { id: 's23', classId: '2nd', name: 'Maxime Fontaine', birthDate: '2010-03-21' },
  { id: 's24', classId: '2nd', name: 'Oscar Lefèvre', birthDate: '2010-12-08' },
  { id: 's25', classId: '1st-s', name: 'Léa Bernard', birthDate: '2009-06-30' },
  { id: 's26', classId: '1st-s', name: 'Tom Bernard', birthDate: '2009-06-30' },
  { id: 's27', classId: '1st-s', name: 'Camille Girard', birthDate: '2009-02-11' },
  { id: 's28', classId: 'term-s', name: 'Arthur Mercier', birthDate: '2008-01-25' },
  { id: 's29', classId: 'term-s', name: 'Manon Mercier', birthDate: '2008-01-25' },
  { id: 's30', classId: 'term-s', name: 'Paul Nguyen', birthDate: '2008-07-07' },
] as const

/** Guardian for s9 (previously missing) plus guardians for new students. */
export const SEED_POPULATION_GUARDIANS: readonly SeedPopulationGuardian[] = [
  {
    id: 'g9',
    name: 'Isabelle Vasseur',
    email: 'i.vasseur@mail.com',
    phone: '+33 6 44 55 66 77',
    studentIds: ['s9'],
    relationship: 'mother',
  },
  {
    id: 'g10',
    name: 'Nicolas Martin',
    email: 'n.martin@mail.com',
    phone: '+33 6 77 88 99 00',
    studentIds: ['s14', 's15'],
    relationship: 'father',
  },
  {
    id: 'g11',
    name: 'Céline Dubois',
    email: 'c.dubois@mail.com',
    phone: '+33 6 66 55 44 33',
    studentIds: ['s16'],
    relationship: 'mother',
  },
  {
    id: 'g12',
    name: 'Marc Petit',
    email: 'm.petit@mail.com',
    phone: '+33 6 12 98 76 54',
    studentIds: ['s17'],
    relationship: 'father',
  },
  {
    id: 'g13',
    name: 'Nadia Roux',
    email: 'n.roux@mail.com',
    phone: '+33 6 23 45 67 89',
    studentIds: ['s18'],
    relationship: 'mother',
  },
  {
    id: 'g14',
    name: 'Ousmane Diallo',
    email: 'o.diallo@mail.com',
    phone: '+33 6 34 56 78 90',
    studentIds: ['s19', 's20'],
    relationship: 'father',
  },
  {
    id: 'g15',
    name: 'Karim Benali',
    email: 'k.benali@mail.com',
    phone: '+33 6 45 67 89 01',
    studentIds: ['s21'],
    relationship: 'father',
  },
  {
    id: 'g16',
    name: 'Sophie Fontaine',
    email: 's.fontaine@mail.com',
    phone: '+33 6 56 78 90 12',
    studentIds: ['s22', 's23'],
    relationship: 'mother',
  },
  {
    id: 'g17',
    name: 'Philippe Lefèvre',
    email: 'p.lefevre@mail.com',
    phone: '+33 6 67 89 01 23',
    studentIds: ['s24'],
    relationship: 'father',
  },
  {
    id: 'g18',
    name: 'Valérie Bernard',
    email: 'v.bernard@mail.com',
    phone: '+33 6 78 90 12 34',
    studentIds: ['s25', 's26'],
    relationship: 'mother',
  },
  {
    id: 'g19',
    name: 'Éric Girard',
    email: 'e.girard@mail.com',
    phone: '+33 6 89 01 23 45',
    studentIds: ['s27'],
    relationship: 'father',
  },
  {
    id: 'g20',
    name: 'Thérèse Mercier',
    email: 't.mercier@mail.com',
    phone: '+33 6 90 12 34 56',
    studentIds: ['s28', 's29'],
    relationship: 'mother',
  },
  {
    id: 'g21',
    name: 'Minh Nguyen',
    email: 'm.nguyen@mail.com',
    phone: '+33 6 01 23 45 67',
    studentIds: ['s30'],
    relationship: 'father',
  },
] as const

/** Class offerings for previously empty or thin class groups. */
export const SEED_POPULATION_CLASS_SUBJECTS: readonly SeedPopulationClassSubject[] = [
  { id: 'cs-6b-hist', classGroupId: '6b', subjectId: 'subj-hist', coefficient: 2, teacherId: 'st3' },
  { id: 'cs-6b-sci', classGroupId: '6b', subjectId: 'subj-sci', coefficient: 2, teacherId: 'st1' },
  { id: 'cs-6b-en', classGroupId: '6b', subjectId: 'subj-en', coefficient: 2, teacherId: 'st7' },
  { id: 'cs-6b-eps', classGroupId: '6b', subjectId: 'subj-eps', coefficient: 1, teacherId: 'st7' },
  { id: 'cs-2nd-math', classGroupId: '2nd', subjectId: 'subj-math', coefficient: 3, teacherId: 'st1' },
  { id: 'cs-2nd-fr', classGroupId: '2nd', subjectId: 'subj-fr', coefficient: 2, teacherId: 'st2' },
  { id: 'cs-2nd-en', classGroupId: '2nd', subjectId: 'subj-en', coefficient: 2, teacherId: 'st7' },
  { id: 'cs-1st-math', classGroupId: '1st-s', subjectId: 'subj-advmath', coefficient: 3, teacherId: 'st4' },
  { id: 'cs-1st-fr', classGroupId: '1st-s', subjectId: 'subj-fr', coefficient: 2, teacherId: 'st2' },
  { id: 'cs-1st-phys', classGroupId: '1st-s', subjectId: 'subj-phys', coefficient: 3, teacherId: 'st4' },
] as const

export const SEED_POPULATION_STUDENT_FEES = [
  { id: 'b11', studentId: 's17', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b12', studentId: 's18', feeId: 'f1', total: 4800, dueDate: '2026-05-30' },
  { id: 'b13', studentId: 's22', feeId: 'f2', total: 5600, dueDate: '2026-05-30' },
  { id: 'b14', studentId: 's25', feeId: 'f2', total: 5600, dueDate: '2026-05-30' },
  { id: 'b15', studentId: 's28', feeId: 'f2', total: 5600, dueDate: '2026-06-15' },
] as const

export const SEED_POPULATION_PAYMENTS = [
  { id: 'pay-b11-1', studentFeeId: 'b11', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b12-1', studentFeeId: 'b12', amount: 1600, paymentDate: '2025-09-15' },
  { id: 'pay-b13-1', studentFeeId: 'b13', amount: 2800, paymentDate: '2025-09-15' },
] as const

export const SEED_POPULATION_AUTH_GUARDIANS = [
  { guardianId: 'g9', email: 'i.vasseur@mail.com', name: 'Isabelle Vasseur' },
  { guardianId: 'g10', email: 'n.martin@mail.com', name: 'Nicolas Martin' },
  { guardianId: 'g11', email: 'c.dubois@mail.com', name: 'Céline Dubois' },
  { guardianId: 'g12', email: 'm.petit@mail.com', name: 'Marc Petit' },
  { guardianId: 'g13', email: 'n.roux@mail.com', name: 'Nadia Roux' },
  { guardianId: 'g14', email: 'o.diallo@mail.com', name: 'Ousmane Diallo' },
  { guardianId: 'g15', email: 'k.benali@mail.com', name: 'Karim Benali' },
  { guardianId: 'g16', email: 's.fontaine@mail.com', name: 'Sophie Fontaine' },
  { guardianId: 'g17', email: 'p.lefevre@mail.com', name: 'Philippe Lefèvre' },
  { guardianId: 'g18', email: 'v.bernard@mail.com', name: 'Valérie Bernard' },
  { guardianId: 'g19', email: 'e.girard@mail.com', name: 'Éric Girard' },
  { guardianId: 'g20', email: 't.mercier@mail.com', name: 'Thérèse Mercier' },
  { guardianId: 'g21', email: 'm.nguyen@mail.com', name: 'Minh Nguyen' },
] as const

/** Expected student count after all fixture modules merge. */
export const SEED_TARGET_STUDENT_COUNT = 30

/** Student ids grouped by class — used by assessments and integration tests. */
export const SEED_CLASS_STUDENT_IDS = {
  '6a': ['s1', 's2', 's3', 's4', 's5', 's6'],
  '6b': ['s7', 's8', 's14', 's15', 's16'],
  '5a': ['s11', 's17', 's18'],
  '4a': ['s12', 's19', 's20'],
  '3a': ['s13', 's21'],
  '2nd': ['s22', 's23', 's24'],
  '1st-s': ['s25', 's26', 's27'],
  'term-s': ['s9', 's10', 's28', 's29', 's30'],
} as const satisfies Record<string, readonly string[]>

export function countSeedPopulationStudents(): number {
  return SEED_POPULATION_STUDENTS.length
}

export function countSeedPopulationGuardians(): number {
  return SEED_POPULATION_GUARDIANS.length
}
