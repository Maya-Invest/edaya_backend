import type {
  ClassGroupInput,
  GuardianInput,
  GuardianStudentLinkInput,
  StudentClassEnrollmentInput,
  StudentInput,
} from '@edaya/core'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import { BULK_CLASS_CAPACITY, BULK_NARRATIVE_STUDENT_ID_MAX, BULK_TARGET_STUDENT_COUNT } from './constants'
import { buildBulkGuardianEmail } from './email'

export interface BulkGeneratedPopulation {
  classGroups: ClassGroupInput[]
  students: StudentInput[]
  guardians: GuardianInput[]
  enrollments: StudentClassEnrollmentInput[]
  guardianLinks: GuardianStudentLinkInput[]
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

const PARENT_FIRST_NAMES = {
  mother: ['Marie', 'Sophie', 'Isabelle', 'Valérie', 'Céline', 'Nadia', 'Fatou', 'Claire', 'Julie', 'Anne'],
  father: ['Nicolas', 'Marc', 'Philippe', 'Thomas', 'Karim', 'James', 'David', 'Éric', 'Samuel', 'Luc'],
} as const

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

export function generateBulkPopulation(): BulkGeneratedPopulation {
  const bulkStudentCount = BULK_TARGET_STUDENT_COUNT - BULK_NARRATIVE_STUDENT_ID_MAX
  const classCount = Math.ceil(bulkStudentCount / BULK_CLASS_CAPACITY)
  const rng = mulberry32(20260627)

  const classGroups: ClassGroupInput[] = Array.from({ length: classCount }, (_, index) => {
    const section = String(index + 1).padStart(2, '0')
    const grade = GRADE_LEVELS[index % GRADE_LEVELS.length]!
    return {
      id: `bulk-${section}`,
      schoolId: DEMO_CENTRAL_SCHOOL_ID,
      academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
      gradeLevelId: grade.id,
      name: `${grade.label} — Bulk ${section}`,
      capacity: BULK_CLASS_CAPACITY,
      homeroomStaffId: HOMEROOM_STAFF_IDS[index % HOMEROOM_STAFF_IDS.length]!,
    }
  })

  const students: StudentInput[] = []
  const guardians: GuardianInput[] = []
  const enrollments: StudentClassEnrollmentInput[] = []
  const guardianLinks: GuardianStudentLinkInput[] = []

  let studentNumber = BULK_NARRATIVE_STUDENT_ID_MAX + 1
  for (let classIndex = 0; classIndex < classCount && studentNumber <= BULK_TARGET_STUDENT_COUNT; classIndex++) {
    const classGroup = classGroups[classIndex]!
    const grade = GRADE_LEVELS.find(entry => entry.id === classGroup.gradeLevelId) ?? GRADE_LEVELS[0]!
    const remaining = BULK_TARGET_STUDENT_COUNT - studentNumber + 1
    const classSize = Math.min(BULK_CLASS_CAPACITY, remaining)

    for (let seat = 0; seat < classSize; seat++) {
      const id = `s${studentNumber}`
      const firstName = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)]!
      const lastName = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)]!
      const month = String(Math.floor(rng() * 12) + 1).padStart(2, '0')
      const day = String(Math.floor(rng() * 28) + 1).padStart(2, '0')

      const relationship = rng() > 0.5 ? 'mother' : 'father'
      const parentFirstName = pickParentFirstName(relationship, rng)
      const guardianId = guardianIdForStudent(id)

      students.push({
        id,
        schoolId: DEMO_CENTRAL_SCHOOL_ID,
        firstName,
        lastName,
        birthDate: `${grade.birthYear}-${month}-${day}`,
      })

      enrollments.push({
        id: `enr-${id}`,
        studentId: id,
        classGroupId: classGroup.id,
        academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
        enrollmentIndex: 1,
      })

      guardians.push({
        id: guardianId,
        schoolId: DEMO_CENTRAL_SCHOOL_ID,
        firstName: parentFirstName,
        lastName,
        email: buildBulkGuardianEmail(parentFirstName, lastName, studentNumber),
        phone: `+1 613 ${String(200 + (studentNumber % 700)).padStart(3, '0')} ${String(1000 + (studentNumber % 9000)).slice(-4)}`,
      })

      guardianLinks.push({
        id: `link-${guardianId}-${id}`,
        schoolId: DEMO_CENTRAL_SCHOOL_ID,
        guardianId,
        studentId: id,
        relationship,
        isPrimary: true,
        legalGuardian: true,
      })

      studentNumber++
    }
  }

  return { classGroups, students, guardians, enrollments, guardianLinks }
}
