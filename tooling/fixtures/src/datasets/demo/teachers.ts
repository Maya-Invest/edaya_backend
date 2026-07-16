import type { TeacherAssignmentInput, TeacherInput } from '@edaya/core'
import { TeacherAssignmentKind } from '@edaya/core'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'

export const demoTeachers = [
  {
    id: 't1',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'Mme',
    lastName: 'Dupont',
    email: 'm.dupont@school.edu',
  },
  {
    id: 't2',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    firstName: 'M.',
    lastName: 'Garnier',
    email: 'm.garnier@school.edu',
  },
] as const satisfies readonly TeacherInput[]

export const demoTeacherAssignments = [
  {
    id: 'ta-t1-6a',
    teacherId: 't1',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    kind: TeacherAssignmentKind.Homeroom,
    classGroupId: '6a',
    responsibility: 'Mathematics',
  },
  {
    id: 'ta-t1-5a',
    teacherId: 't1',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    kind: TeacherAssignmentKind.Homeroom,
    classGroupId: '5a',
    responsibility: 'Mathematics',
  },
  {
    id: 'ta-t2-6b',
    teacherId: 't2',
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    kind: TeacherAssignmentKind.Homeroom,
    classGroupId: '6b',
    responsibility: 'Homeroom',
  },
] as const satisfies readonly TeacherAssignmentInput[]
