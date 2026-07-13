import type { TeacherAssignmentInput, TeacherInput } from '@edaya/core'
import { TeacherAssignmentKind } from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../shared/ids'
import { demoCiClassSubjects, demoCiSubjects } from './school'

type DemoCiTeacherId = 'ci-t1' | 'ci-t2' | 'ci-t3' | 'ci-t4' | 'ci-t5'

const SUBJECT_TEACHER_BY_ID: Record<string, DemoCiTeacherId> = {
  'ci-subj-math': 'ci-t1',
  'ci-subj-pc': 'ci-t1',
  'ci-subj-fr': 'ci-t3',
  'ci-subj-hg': 'ci-t4',
  'ci-subj-edhc': 'ci-t4',
  'ci-subj-svt': 'ci-t5',
  'ci-subj-ang': 'ci-t5',
  'ci-subj-eps': 'ci-t2',
}

const subjectNameById = Object.fromEntries(demoCiSubjects.map(subject => [subject.id, subject.name]))

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
  {
    id: 'ci-t3',
    schoolId: DEMO_CI_SCHOOL_ID,
    firstName: 'Mme',
    lastName: 'N\'Guessan',
    email: 's.nguessan@ecole-ci.edaya.dev',
  },
  {
    id: 'ci-t4',
    schoolId: DEMO_CI_SCHOOL_ID,
    firstName: 'M.',
    lastName: 'Traoré',
    email: 'y.traore@ecole-ci.edaya.dev',
  },
  {
    id: 'ci-t5',
    schoolId: DEMO_CI_SCHOOL_ID,
    firstName: 'Mme',
    lastName: 'Bamba',
    email: 'n.bamba@ecole-ci.edaya.dev',
  },
] as const satisfies readonly TeacherInput[]

export const demoCiTeacherAssignments = [
  ...demoCiClassSubjects.map((classSubject) => {
    const teacherId = SUBJECT_TEACHER_BY_ID[classSubject.subjectId]
    if (!teacherId) {
      throw new Error(`Missing demo-ci teacher mapping for subject ${classSubject.subjectId}`)
    }

    return {
      id: `ta-${classSubject.id}`,
      teacherId,
      academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
      kind: TeacherAssignmentKind.Subject,
      classSubjectId: classSubject.id,
      responsibility: subjectNameById[classSubject.subjectId] ?? classSubject.subjectId,
    }
  }),
  {
    id: 'ta-ci-t2-6b',
    teacherId: 'ci-t2',
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    kind: TeacherAssignmentKind.Homeroom,
    classGroupId: 'ci-6b',
    responsibility: 'Professeur principal',
  },
] as const satisfies readonly TeacherAssignmentInput[]
