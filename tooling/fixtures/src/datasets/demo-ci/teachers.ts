import type { TeacherAssignmentInput, TeacherInput } from '@edaya/core'
import { TeacherAssignmentKind } from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../shared/ids'

export const demoCiTeachers = [
  {
    id: 'ci-t1',
    schoolId: DEMO_CI_SCHOOL_ID,
    firstName: 'Mme',
    lastName: 'Touré',
    email: 'a.toure@ecole-ci.edaya.dev',
  },
  {
    id: 'ci-t2',
    schoolId: DEMO_CI_SCHOOL_ID,
    firstName: 'M.',
    lastName: 'Diomandé',
    email: 'k.diomande@ecole-ci.edaya.dev',
  },
] as const satisfies readonly TeacherInput[]

export const demoCiTeacherAssignments = [
  {
    id: 'ta-ci-t1-6a-math',
    teacherId: 'ci-t1',
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    kind: TeacherAssignmentKind.Subject,
    classSubjectId: 'ci-cs-6a-math',
    responsibility: 'Mathématiques',
  },
  {
    id: 'ta-ci-t1-5a-math',
    teacherId: 'ci-t1',
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    kind: TeacherAssignmentKind.Subject,
    classSubjectId: 'ci-cs-5a-math',
    responsibility: 'Mathématiques',
  },
  {
    id: 'ta-ci-t2-6b',
    teacherId: 'ci-t2',
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    kind: TeacherAssignmentKind.Homeroom,
    classGroupId: 'ci-6b',
    responsibility: 'Professeur principal',
  },
] as const satisfies readonly TeacherAssignmentInput[]
