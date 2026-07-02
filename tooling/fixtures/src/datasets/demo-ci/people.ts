import type {
  GuardianInput,
  GuardianStudentLinkInput,
  StaffMemberInput,
  StudentClassEnrollmentInput,
  StudentInput,
} from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../shared/ids'

export const demoCiStudents = [
  { id: 'ci-s1', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Aminata', lastName: 'Koné', birthDate: '2014-02-14' },
  { id: 'ci-s2', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Moussa', lastName: 'Traoré', birthDate: '2014-06-22' },
  { id: 'ci-s3', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Fatou', lastName: 'Diabaté', birthDate: '2014-11-03' },
  { id: 'ci-s4', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Kouadio', lastName: 'Yao', birthDate: '2014-04-18' },
  { id: 'ci-s5', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Mariam', lastName: 'Coulibaly', birthDate: '2014-09-07' },
  { id: 'ci-s6', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Ibrahim', lastName: 'Ouattara', birthDate: '2014-01-29' },
  { id: 'ci-s7', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Adjoua', lastName: 'Bamba', birthDate: '2013-08-12' },
  { id: 'ci-s8', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Seydou', lastName: 'Bamba', birthDate: '2013-08-12' },
  { id: 'ci-s9', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Akissi', lastName: 'N\'Guessan', birthDate: '2013-05-25' },
  { id: 'ci-s10', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Yao', lastName: 'Koffi', birthDate: '2013-12-01' },
  { id: 'ci-s11', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Aïcha', lastName: 'Sanogo', birthDate: '2012-03-16' },
  { id: 'ci-s12', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Kader', lastName: 'Sanogo', birthDate: '2012-03-16' },
] as const satisfies readonly StudentInput[]

export const demoCiEnrollments = [
  { id: 'ci-enr-s1', studentId: 'ci-s1', classGroupId: 'ci-6a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s2', studentId: 'ci-s2', classGroupId: 'ci-6a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s3', studentId: 'ci-s3', classGroupId: 'ci-6a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s4', studentId: 'ci-s4', classGroupId: 'ci-6a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s5', studentId: 'ci-s5', classGroupId: 'ci-6a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s6', studentId: 'ci-s6', classGroupId: 'ci-6a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s7', studentId: 'ci-s7', classGroupId: 'ci-6b', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s8', studentId: 'ci-s8', classGroupId: 'ci-6b', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s9', studentId: 'ci-s9', classGroupId: 'ci-6b', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s10', studentId: 'ci-s10', classGroupId: 'ci-6b', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s11', studentId: 'ci-s11', classGroupId: 'ci-5a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
  { id: 'ci-enr-s12', studentId: 'ci-s12', classGroupId: 'ci-5a', academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, enrollmentIndex: 1 },
] as const satisfies readonly StudentClassEnrollmentInput[]

export const demoCiStaffMembers = [
  { id: 'ci-st8', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Aminata', lastName: 'Koné', email: 'a.kone@ecole-ci.edaya.dev' },
  { id: 'ci-st5', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Jean-Baptiste', lastName: 'Aka', email: 'j.aka@ecole-ci.edaya.dev' },
  { id: 'ci-st3', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Mme', lastName: 'Assi', email: 'f.assi@ecole-ci.edaya.dev' },
  { id: 'ci-st1', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Mme', lastName: 'Touré', email: 'a.toure@ecole-ci.edaya.dev' },
  { id: 'ci-st2', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'M.', lastName: 'Diomandé', email: 'k.diomande@ecole-ci.edaya.dev' },
  { id: 'ci-st4', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'M.', lastName: 'Gbé', email: 'p.gbe@ecole-ci.edaya.dev' },
  { id: 'ci-st7', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Mme', lastName: 'Zongo', email: 'm.zongo@ecole-ci.edaya.dev' },
] as const satisfies readonly StaffMemberInput[]

export const demoCiSchoolOwnerStaffId = 'ci-st8' as const

export const demoCiGuardians = [
  { id: 'ci-g1', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Mariam', lastName: 'Koné', email: 'm.kone@mail.ci', phone: '+225 07 12 34 56 78' },
  { id: 'ci-g2', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Issouf', lastName: 'Traoré', email: 'i.traore@mail.ci', phone: '+225 05 98 76 54 32' },
  { id: 'ci-g3', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Salimata', lastName: 'Diabaté', email: 's.diabate@mail.ci', phone: '+225 01 23 45 67 89' },
  { id: 'ci-g4', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Koffi', lastName: 'Yao', email: 'k.yao@mail.ci', phone: '+225 07 55 44 33 22' },
  { id: 'ci-g5', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Awa', lastName: 'Coulibaly', email: 'a.coulibaly@mail.ci', phone: '+225 05 11 22 33 44' },
  { id: 'ci-g6', schoolId: DEMO_CI_SCHOOL_ID, firstName: 'Oumar', lastName: 'Ouattara', email: 'o.ouattara@mail.ci', phone: '+225 01 77 88 99 00' },
] as const satisfies readonly GuardianInput[]

export const demoCiGuardianLinks = [
  { id: 'ci-gl-1', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g1', studentId: 'ci-s1', relationship: 'Mère', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-2', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g2', studentId: 'ci-s2', relationship: 'Père', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-3', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g3', studentId: 'ci-s3', relationship: 'Mère', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-4', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g4', studentId: 'ci-s4', relationship: 'Père', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-5', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g5', studentId: 'ci-s5', relationship: 'Mère', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-6', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g6', studentId: 'ci-s6', relationship: 'Père', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-7', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g4', studentId: 'ci-s7', relationship: 'Père', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-8', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g4', studentId: 'ci-s8', relationship: 'Père', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-9', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g3', studentId: 'ci-s9', relationship: 'Tante', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-10', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g1', studentId: 'ci-s10', relationship: 'Mère', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-11', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g5', studentId: 'ci-s11', relationship: 'Mère', isPrimary: true, legalGuardian: true },
  { id: 'ci-gl-12', schoolId: DEMO_CI_SCHOOL_ID, guardianId: 'ci-g5', studentId: 'ci-s12', relationship: 'Mère', isPrimary: true, legalGuardian: true },
] as const satisfies readonly GuardianStudentLinkInput[]
