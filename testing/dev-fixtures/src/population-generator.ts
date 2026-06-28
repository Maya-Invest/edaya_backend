/**
 * Phase 6 — programmatic bulk population (s31–s1000) with classes, guardians, and enrollments.
 * Narrative fixtures s1–s30 stay hand-crafted in dataset / extended / population-seed.
 */

import type { SeedPopulationGuardian, SeedPopulationStudent } from './population-seed'

export const SEED_TARGET_STUDENT_COUNT = 1000
export const SEED_NARRATIVE_STUDENT_ID_MAX = 30
export const SEED_BULK_CLASS_CAPACITY = 30

export interface SeedBulkClass {
  id: string
  gradeLevelId: string
  name: string
  capacity: number
  homeroomStaffId: string
}

const GRADE_LEVELS = [
  { id: 'gl-6', label: '6th', birthYear: 2014 },
  { id: 'gl-5', label: '5th', birthYear: 2013 },
  { id: 'gl-4', label: '4th', birthYear: 2012 },
  { id: 'gl-3', label: '3rd', birthYear: 2011 },
  { id: 'gl-2', label: '2nd', birthYear: 2010 },
  { id: 'gl-1', label: '1st', birthYear: 2009 },
  { id: 'gl-t', label: 'Term', birthYear: 2008 },
] as const

const FIRST_NAMES = [
  'Emma',
  'Liam',
  'Olivia',
  'Noah',
  'Sophia',
  'William',
  'Ava',
  'James',
  'Isabella',
  'Lucas',
  'Mia',
  'Benjamin',
  'Charlotte',
  'Ethan',
  'Amelia',
  'Alexander',
  'Harper',
  'Daniel',
  'Evelyn',
  'Mateo',
  'Chloé',
  'Nathan',
  'Léa',
  'Samuel',
  'Camille',
  'Thomas',
  'Zoé',
  'Gabriel',
  'Alice',
  'Raphaël',
] as const

const LAST_NAMES = [
  'Tremblay',
  'Gagnon',
  'Roy',
  'Côté',
  'Bouchard',
  'Gauthier',
  'Morin',
  'Lavoie',
  'Fortin',
  'Gagné',
  'Ouellet',
  'Pelletier',
  'Bélanger',
  'Bergeron',
  'Leblanc',
  'Paquette',
  'Girard',
  'Simard',
  'Boucher',
  'Caron',
  'Nguyen',
  'Patel',
  'Singh',
  'Khan',
  'Martin',
  'Bernard',
  'Dubois',
  'Thomas',
  'Robert',
  'Richard',
] as const

const HOMEROOM_STAFF_IDS = ['st1', 'st2', 'st3', 'st4', 'st6', 'st7'] as const

const GUARDIAN_EMAIL_DOMAINS = [
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.ca',
  'icloud.com',
  'live.ca',
] as const

const PARENT_FIRST_NAMES = {
  mother: ['Marie', 'Sophie', 'Isabelle', 'Valérie', 'Céline', 'Nadia', 'Fatou', 'Claire', 'Julie', 'Anne'],
  father: ['Nicolas', 'Marc', 'Philippe', 'Thomas', 'Karim', 'James', 'David', 'Éric', 'Samuel', 'Luc'],
} as const

function slugifyEmailPart(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
}

/** Realistic guardian inbox — aligned with narrative fixtures (e.g. n.martin@mail.com). */
export function buildBulkGuardianEmail(
  parentFirstName: string,
  lastName: string,
  studentNumber: number,
): string {
  const first = slugifyEmailPart(parentFirstName)
  const last = slugifyEmailPart(lastName)
  const domain = GUARDIAN_EMAIL_DOMAINS[studentNumber % GUARDIAN_EMAIL_DOMAINS.length]!
  const tag = String(studentNumber)

  switch (studentNumber % 4) {
    case 0:
      return `${first.charAt(0)}.${last}${tag}@${domain}`
    case 1:
      return `${first}.${last}${tag}@${domain}`
    case 2:
      return `${first.charAt(0)}.${last}.${tag}@${domain}`
    default:
      return `${first}${tag}@${domain}`
  }
}

function pickParentFirstName(relationship: 'mother' | 'father', rng: () => number): string {
  const pool = PARENT_FIRST_NAMES[relationship]
  return pool[Math.floor(rng() * pool.length)]!
}

function mulberry32(seed: number) {
  let state = seed
  return () => {
    state += 0x6D2B79F5
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function guardianIdForStudent(studentId: string): string {
  const studentNumber = Number.parseInt(studentId.slice(1), 10)
  return `g${studentNumber - 9}`
}

function generateBulkPopulation(): {
  classes: SeedBulkClass[]
  students: SeedPopulationStudent[]
  guardians: SeedPopulationGuardian[]
} {
  const bulkStudentCount = SEED_TARGET_STUDENT_COUNT - SEED_NARRATIVE_STUDENT_ID_MAX
  const classCount = Math.ceil(bulkStudentCount / SEED_BULK_CLASS_CAPACITY)
  const rng = mulberry32(20260627)

  const classes: SeedBulkClass[] = Array.from({ length: classCount }, (_, index) => {
    const section = String(index + 1).padStart(2, '0')
    const grade = GRADE_LEVELS[index % GRADE_LEVELS.length]!
    return {
      id: `bulk-${section}`,
      gradeLevelId: grade.id,
      name: `${grade.label} — Bulk ${section}`,
      capacity: SEED_BULK_CLASS_CAPACITY,
      homeroomStaffId: HOMEROOM_STAFF_IDS[index % HOMEROOM_STAFF_IDS.length]!,
    }
  })

  const students: SeedPopulationStudent[] = []
  const guardians: SeedPopulationGuardian[] = []

  let studentNumber = SEED_NARRATIVE_STUDENT_ID_MAX + 1
  for (let classIndex = 0; classIndex < classCount && studentNumber <= SEED_TARGET_STUDENT_COUNT; classIndex++) {
    const classGroup = classes[classIndex]!
    const grade = GRADE_LEVELS.find(entry => entry.id === classGroup.gradeLevelId) ?? GRADE_LEVELS[0]!
    const remaining = SEED_TARGET_STUDENT_COUNT - studentNumber + 1
    const classSize = Math.min(SEED_BULK_CLASS_CAPACITY, remaining)

    for (let seat = 0; seat < classSize; seat++) {
      const id = `s${studentNumber}`
      const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]!
      const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]!
      const month = String(Math.floor(rng() * 12) + 1).padStart(2, '0')
      const day = String(Math.floor(rng() * 28) + 1).padStart(2, '0')

      const relationship = rng() > 0.5 ? 'mother' : 'father'
      const parentFirstName = pickParentFirstName(relationship, rng)

      students.push({
        id,
        classId: classGroup.id,
        name: `${firstName} ${lastName}`,
        birthDate: `${grade.birthYear}-${month}-${day}`,
      })

      guardians.push({
        id: guardianIdForStudent(id),
        name: `${parentFirstName} ${lastName}`,
        email: buildBulkGuardianEmail(parentFirstName, lastName, studentNumber),
        phone: `+1 613 ${String(200 + (studentNumber % 700)).padStart(3, '0')} ${String(1000 + (studentNumber % 9000)).slice(-4)}`,
        studentIds: [id],
        relationship,
      })

      studentNumber++
    }
  }

  return { classes, students, guardians }
}

export function buildClassStudentIds(
  students: readonly { id: string, classId: string }[],
): Record<string, readonly string[]> {
  const map = new Map<string, string[]>()
  for (const student of students) {
    const current = map.get(student.classId) ?? []
    current.push(student.id)
    map.set(student.classId, current)
  }
  return Object.fromEntries(map)
}

const bulkPopulation = generateBulkPopulation()

export const SEED_BULK_CLASSES: readonly SeedBulkClass[] = bulkPopulation.classes
export const SEED_BULK_STUDENTS: readonly SeedPopulationStudent[] = bulkPopulation.students
export const SEED_BULK_GUARDIANS: readonly SeedPopulationGuardian[] = bulkPopulation.guardians

export function countSeedBulkStudents(): number {
  return SEED_BULK_STUDENTS.length
}

export function countSeedBulkGuardians(): number {
  return SEED_BULK_GUARDIANS.length
}

export function countSeedBulkClasses(): number {
  return SEED_BULK_CLASSES.length
}
