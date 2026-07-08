import type { ClassGroupInput, GuardianInput, GuardianStudentLinkInput, StudentClassEnrollmentInput, StudentInput } from '@edaya/core'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import { BULK_CLASS_CAPACITY, BULK_NARRATIVE_STUDENT_ID_MAX, BULK_TARGET_STUDENT_COUNT } from './constants'
import { buildBulkGuardianEmail, buildBulkGuardianEmailCi } from './email'
import {
  CENTRAL_FIRST_NAMES,
  CENTRAL_LAST_NAMES,
  CENTRAL_PARENT_FIRST_NAMES,
  CI_FIRST_NAMES,
  CI_LAST_NAMES,
  CI_PARENT_FIRST_NAMES,
  ENGLISH_GRADE_LABELS,
  FRENCH_GRADE_LABELS,
} from './name-pools'

export interface BulkGeneratedPopulation {
  classGroups: ClassGroupInput[]
  students: StudentInput[]
  guardians: GuardianInput[]
  enrollments: StudentClassEnrollmentInput[]
  guardianLinks: GuardianStudentLinkInput[]
}

export type BulkPopulationLocale = 'central' | 'ci'

export interface BulkPopulationOptions {
  locale?: BulkPopulationLocale
  seed?: number
}

const HOMEROOM_STAFF_IDS = ['st1', 'st2', 'st3', 'st4', 'st6', 'st7'] as const

function pickParentFirstName(
  relationship: 'mother' | 'father',
  rng: () => number,
  locale: BulkPopulationLocale,
): string {
  const pool = locale === 'ci' ? CI_PARENT_FIRST_NAMES[relationship] : CENTRAL_PARENT_FIRST_NAMES[relationship]
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

function buildBulkPhone(studentNumber: number, locale: BulkPopulationLocale): string {
  if (locale === 'ci') {
    const suffix = String(10_000_000 + (studentNumber * 987_653) % 90_000_000).slice(-8)
    return `+225 0${5 + (studentNumber % 3)} ${suffix.slice(0, 2)} ${suffix.slice(2, 4)} ${suffix.slice(4, 6)} ${suffix.slice(6, 8)}`
  }
  return `+1 613 ${String(200 + (studentNumber % 700)).padStart(3, '0')} ${String(1000 + (studentNumber % 9000)).slice(-4)}`
}

function localizeBulkRelationship(relationship: 'mother' | 'father', locale: BulkPopulationLocale): string {
  if (locale !== 'ci') {
    return relationship
  }
  return relationship === 'mother' ? 'Mère' : 'Père'
}

export function generateBulkPopulation(options: BulkPopulationOptions = {}): BulkGeneratedPopulation {
  const locale = options.locale ?? 'central'
  const seed = options.seed ?? 20260627
  const bulkStudentCount = BULK_TARGET_STUDENT_COUNT - BULK_NARRATIVE_STUDENT_ID_MAX
  const classCount = Math.ceil(bulkStudentCount / BULK_CLASS_CAPACITY)
  const rng = mulberry32(seed)

  const firstNames = locale === 'ci' ? CI_FIRST_NAMES : CENTRAL_FIRST_NAMES
  const lastNames = locale === 'ci' ? CI_LAST_NAMES : CENTRAL_LAST_NAMES
  const gradeLevels = locale === 'ci' ? FRENCH_GRADE_LABELS : ENGLISH_GRADE_LABELS
  const bulkSectionLabel = locale === 'ci' ? 'Groupe' : 'Bulk'

  const classGroups: ClassGroupInput[] = Array.from({ length: classCount }, (_, index) => {
    const section = String(index + 1).padStart(2, '0')
    const grade = gradeLevels[index % gradeLevels.length]!
    return {
      id: `bulk-${section}`,
      schoolId: DEMO_CENTRAL_SCHOOL_ID,
      academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
      gradeLevelId: grade.id,
      name: `${grade.label} — ${bulkSectionLabel} ${section}`,
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
    const grade = gradeLevels.find(entry => entry.id === classGroup.gradeLevelId) ?? gradeLevels[0]!
    const remaining = BULK_TARGET_STUDENT_COUNT - studentNumber + 1
    const classSize = Math.min(BULK_CLASS_CAPACITY, remaining)

    for (let seat = 0; seat < classSize; seat++) {
      const id = `s${studentNumber}`
      const firstName = firstNames[Math.floor(rng() * firstNames.length)]!
      const lastName = lastNames[Math.floor(rng() * lastNames.length)]!
      const month = String(Math.floor(rng() * 12) + 1).padStart(2, '0')
      const day = String(Math.floor(rng() * 28) + 1).padStart(2, '0')

      const relationship = rng() > 0.5 ? 'mother' : 'father'
      const parentFirstName = pickParentFirstName(relationship, rng, locale)
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
        email: locale === 'ci'
          ? buildBulkGuardianEmailCi(parentFirstName, lastName, studentNumber)
          : buildBulkGuardianEmail(parentFirstName, lastName, studentNumber),
        phone: buildBulkPhone(studentNumber, locale),
      })

      guardianLinks.push({
        id: `link-${guardianId}-${id}`,
        schoolId: DEMO_CENTRAL_SCHOOL_ID,
        guardianId,
        studentId: id,
        relationship: localizeBulkRelationship(relationship, locale),
        isPrimary: true,
        legalGuardian: true,
      })

      studentNumber++
    }
  }

  return { classGroups, students, guardians, enrollments, guardianLinks }
}
