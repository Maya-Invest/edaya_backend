import type { FixtureDataset } from '../types'
import { DEMO_CI_SCHOOL_ID } from '../../shared/ids'
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
import {
  demoCiClassResourceAssignments,
  demoCiResources,
  demoCiSchedules,
  demoCiSchedulingSlots,
} from './domains/scheduling'

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
