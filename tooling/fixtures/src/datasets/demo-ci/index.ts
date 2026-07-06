import type { FixtureDataset } from '../types'
import { DEMO_CI_SCHOOL_ID } from '../../shared/ids'
import {
  demoCiClassResourceAssignments,
  demoCiResources,
  demoCiSchedules,
  demoCiSchedulingSlots,
} from './domains/scheduling'
import {
  demoCiEnrollments,
  demoCiGuardianLinks,
  demoCiGuardians,
  demoCiStaffMembers,
  demoCiStudents,
} from './people'
import {
  demoCiAcademicPeriods,
  demoCiAcademicYear,
  demoCiClassGroups,
  demoCiClassSubjects,
  demoCiGradeLevels,
  demoCiPeriodDefinitions,
  demoCiSchool,
  demoCiSubjectMatters,
  demoCiSubjects,
} from './school'
import { demoCiTeacherAssignments, demoCiTeachers } from './teachers'

export const demoCiDataset = {
  purpose: 'demo-ci',
  schoolId: DEMO_CI_SCHOOL_ID,
  entities: {
    school: demoCiSchool,
    academicYear: demoCiAcademicYear,
    academicPeriods: demoCiAcademicPeriods,
    gradeLevels: demoCiGradeLevels,
    periodDefinitions: demoCiPeriodDefinitions,
    classGroups: demoCiClassGroups,
    staffMembers: demoCiStaffMembers,
    teachers: demoCiTeachers,
    teacherAssignments: demoCiTeacherAssignments,
    students: demoCiStudents,
    enrollments: demoCiEnrollments,
    guardians: demoCiGuardians,
    guardianLinks: demoCiGuardianLinks,
    subjects: demoCiSubjects,
    subjectMatters: demoCiSubjectMatters,
    classSubjects: demoCiClassSubjects,
    resources: demoCiResources,
    schedules: demoCiSchedules,
  },
  extensions: {
    schedulingSlots: demoCiSchedulingSlots,
    classResourceAssignments: demoCiClassResourceAssignments,
  },
} satisfies FixtureDataset<'demo-ci'>
