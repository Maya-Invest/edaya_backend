import type { GuardianInput, GuardianStudentLinkInput, StudentClassEnrollmentInput, StudentInput } from '@edaya/core'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'

export const integrationStudents = [
  {
    id: 's1',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Amélie',
    lastName: 'Laurent',
    birthDate: '2014-03-12',
  },
  {
    id: 's2',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Noah',
    lastName: 'Bennett',
    birthDate: '2014-07-22',
  },
  {
    id: 's3',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Mira',
    lastName: 'Okafor',
    birthDate: '2014-01-09',
  },
  {
    id: 's4',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Theo',
    lastName: 'Marchetti',
    birthDate: '2014-05-30',
  },
  {
    id: 's5',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Yuki',
    lastName: 'Tanaka',
    birthDate: '2014-11-04',
  },
  {
    id: 's6',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Sofia',
    lastName: 'Reyes',
    birthDate: '2014-08-17',
  },
] as const satisfies readonly StudentInput[]

export const integrationGuardians = [
  {
    id: 'g1',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Claire',
    lastName: 'Laurent',
    email: 'c.laurent@mail.com',
    phone: '+33 6 12 34 56 78',
  },
  {
    id: 'g2',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'James',
    lastName: 'Bennett',
    email: 'j.bennett@mail.com',
    phone: '+33 6 22 11 09 87',
  },
  {
    id: 'g3',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Adaeze',
    lastName: 'Okafor',
    email: 'a.okafor@mail.com',
    phone: '+33 6 78 90 12 34',
  },
  {
    id: 'g4',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Luca',
    lastName: 'Marchetti',
    email: 'l.marchetti@mail.com',
    phone: '+33 6 55 66 77 88',
  },
  {
    id: 'g5',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Hana',
    lastName: 'Tanaka',
    email: 'h.tanaka@mail.com',
    phone: '+33 6 11 22 33 44',
  },
  {
    id: 'g6',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Marco',
    lastName: 'Reyes',
    email: 'm.reyes@mail.com',
    phone: '+33 6 88 77 66 55',
  },
] as const satisfies readonly GuardianInput[]

export const integrationEnrollments = [
  {
    id: 'enr-s1',
    studentId: 's1',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    enrollmentIndex: 1,
  },
  {
    id: 'enr-s2',
    studentId: 's2',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    enrollmentIndex: 1,
  },
  {
    id: 'enr-s3',
    studentId: 's3',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    enrollmentIndex: 1,
  },
  {
    id: 'enr-s4',
    studentId: 's4',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    enrollmentIndex: 1,
  },
  {
    id: 'enr-s5',
    studentId: 's5',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    enrollmentIndex: 1,
  },
  {
    id: 'enr-s6',
    studentId: 's6',
    classGroupId: '6a',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    enrollmentIndex: 1,
  },
] as const satisfies readonly StudentClassEnrollmentInput[]

export const integrationGuardianLinks = [
  {
    id: 'link-g1-s1',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    guardianId: 'g1',
    studentId: 's1',
    relationship: 'mother',
    isPrimary: true,
    legalGuardian: true,
  },
  {
    id: 'link-g2-s2',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    guardianId: 'g2',
    studentId: 's2',
    relationship: 'father',
    isPrimary: true,
    legalGuardian: true,
  },
  {
    id: 'link-g3-s3',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    guardianId: 'g3',
    studentId: 's3',
    relationship: 'mother',
    isPrimary: true,
    legalGuardian: true,
  },
  {
    id: 'link-g4-s4',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    guardianId: 'g4',
    studentId: 's4',
    relationship: 'father',
    isPrimary: true,
    legalGuardian: true,
  },
  {
    id: 'link-g5-s5',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    guardianId: 'g5',
    studentId: 's5',
    relationship: 'mother',
    isPrimary: true,
    legalGuardian: true,
  },
  {
    id: 'link-g6-s6',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    guardianId: 'g6',
    studentId: 's6',
    relationship: 'father',
    isPrimary: true,
    legalGuardian: true,
  },
] as const satisfies readonly GuardianStudentLinkInput[]

const enrollmentClassGroupByStudentId = new Map<string, string>(
  integrationEnrollments.map(enrollment => [enrollment.studentId, enrollment.classGroupId]),
)

export function integrationClassGroupIdForStudent(studentId: string): string {
  const classGroupId = enrollmentClassGroupByStudentId.get(studentId)
  if (!classGroupId) {
    throw new Error(`No integration enrollment for student ${studentId}`)
  }
  return classGroupId
}
