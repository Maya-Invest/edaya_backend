import type { AcademicPeriodInput, AcademicYearInput, ClassGroupInput, ClassSubjectInput, GradeLevelInput, PeriodDefinitionInput, SchoolInput, SubjectInput, SubjectMatterInput } from '@edaya/core'
import { SubjectCategory, SubjectColor } from '@edaya/core'
import { DEMO_CENTRAL_ACADEMIC_YEAR_ID, DEMO_CENTRAL_SCHOOL_ID } from '../../shared/ids'
import { buildCatalogSubjectMatters, centralSubjectMatterCatalog } from '../../shared/subject-matter-chapters'
import { minimalSchool } from '../minimal/school'

export const demoSchool = minimalSchool satisfies SchoolInput

export const demoAcademicYear = {
  id: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
  schoolId: DEMO_CENTRAL_SCHOOL_ID,
  name: '2025 — 2026',
  startDate: '2025-09-01',
  endDate: '2026-07-03',
} satisfies AcademicYearInput

export const demoAcademicPeriods = [
  {
    id: '2025-t1',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    name: 'Trimestre 1',
    startDate: '2025-09-01',
    endDate: '2025-12-19',
  },
  {
    id: '2025-t2',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    name: 'Trimestre 2',
    startDate: '2026-01-05',
    endDate: '2026-04-03',
  },
  {
    id: '2025-t3',
    schoolId: DEMO_CENTRAL_SCHOOL_ID,
    academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID,
    name: 'Trimestre 3',
    startDate: '2026-04-20',
    endDate: '2026-07-03',
  },
] as const satisfies readonly AcademicPeriodInput[]

export const demoGradeLevels = [
  { id: 'gl-6', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: '6ème', cycle: 'Middle School', order: 1 },
  { id: 'gl-5', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: '5ème', cycle: 'Middle School', order: 2 },
  { id: 'gl-4', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: '4ème', cycle: 'Middle School', order: 3 },
  { id: 'gl-3', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: '3ème', cycle: 'Middle School', order: 4 },
  { id: 'gl-2', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: '2nde', cycle: 'High School', order: 5 },
  { id: 'gl-1', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: '1ère', cycle: 'High School', order: 6 },
  { id: 'gl-t', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: 'Terminale', cycle: 'High School', order: 7 },
] as const satisfies readonly GradeLevelInput[]

/** Daily time-slot grid — not trimester labels (`academic-periods`). */
export const demoPeriodDefinitions = [
  { id: 'pd-1', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 1', order: 1, startTime: '08:00', endTime: '08:45', isBreak: false },
  { id: 'pd-2', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 2', order: 2, startTime: '08:45', endTime: '09:30', isBreak: false },
  { id: 'pd-break-am', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Récréation', order: 3, startTime: '09:30', endTime: '09:45', isBreak: true },
  { id: 'pd-3', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 3', order: 4, startTime: '09:45', endTime: '10:30', isBreak: false },
  { id: 'pd-4', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 4', order: 5, startTime: '10:30', endTime: '11:15', isBreak: false },
  { id: 'pd-5', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 5', order: 6, startTime: '11:15', endTime: '12:00', isBreak: false },
  { id: 'pd-lunch', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Pause déjeuner', order: 7, startTime: '12:00', endTime: '13:30', isBreak: true },
  { id: 'pd-6', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 6', order: 8, startTime: '13:30', endTime: '14:15', isBreak: false },
  { id: 'pd-7', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 7', order: 9, startTime: '14:15', endTime: '15:00', isBreak: false },
  { id: 'pd-break-pm', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Récréation', order: 10, startTime: '15:00', endTime: '15:15', isBreak: true },
  { id: 'pd-8', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, label: 'Période 8', order: 11, startTime: '15:15', endTime: '16:00', isBreak: false },
] as const satisfies readonly PeriodDefinitionInput[]

/** Core classes — upper grades and extra offerings live in `people.ts`. */
export const demoFoundationClassGroups = [
  { id: '6a', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, gradeLevelId: 'gl-6', name: '6th — A', capacity: 30, homeroomStaffId: 'st3' },
  { id: '6b', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, gradeLevelId: 'gl-6', name: '6th — B', capacity: 30, homeroomStaffId: 'st2' },
  { id: '5a', schoolId: DEMO_CENTRAL_SCHOOL_ID, academicYearId: DEMO_CENTRAL_ACADEMIC_YEAR_ID, gradeLevelId: 'gl-5', name: '5th — A', capacity: 30, homeroomStaffId: 'st3' },
] as const satisfies readonly ClassGroupInput[]

export const demoFoundationSubjects = [
  { id: 'subj-math', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: 'Mathematics', code: 'MATH', defaultCoefficient: 3, category: SubjectCategory.Scientific, color: SubjectColor.Mint },
  { id: 'subj-fr', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: 'French Literature', code: 'FR', defaultCoefficient: 2, category: SubjectCategory.Literary, color: SubjectColor.Warm },
  { id: 'subj-hist', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: 'History & Geography', code: 'HIST', defaultCoefficient: 2, category: SubjectCategory.Humanities, color: SubjectColor.Sky },
  { id: 'subj-sci', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: 'Natural Sciences', code: 'SCI', defaultCoefficient: 2, category: SubjectCategory.Scientific, color: SubjectColor.Warm },
  { id: 'subj-en', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: 'English', code: 'EN', defaultCoefficient: 2, category: SubjectCategory.Languages, color: SubjectColor.Sky },
  { id: 'subj-eps', schoolId: DEMO_CENTRAL_SCHOOL_ID, name: 'Physical Education', code: 'EPS', defaultCoefficient: 1, category: SubjectCategory.Sport, color: SubjectColor.Mint },
] as const satisfies readonly SubjectInput[]

export const demoFoundationSubjectMatters = buildCatalogSubjectMatters(
  {
    'subj-math': centralSubjectMatterCatalog['subj-math'],
    'subj-fr': centralSubjectMatterCatalog['subj-fr'],
    'subj-hist': centralSubjectMatterCatalog['subj-hist'],
    'subj-sci': centralSubjectMatterCatalog['subj-sci'],
    'subj-en': centralSubjectMatterCatalog['subj-en'],
    'subj-eps': centralSubjectMatterCatalog['subj-eps'],
  },
  {
    'subj-math': 'sm-math-',
    'subj-fr': 'sm-fr-',
    'subj-hist': 'sm-hist-',
    'subj-sci': 'sm-sci-',
    'subj-en': 'sm-en-',
    'subj-eps': 'sm-eps-',
  },
) satisfies readonly SubjectMatterInput[]

export const demoFoundationClassSubjects = [
  { id: 'cs-6a-math', classGroupId: '6a', subjectId: 'subj-math', coefficient: 3 },
  { id: 'cs-6a-fr', classGroupId: '6a', subjectId: 'subj-fr', coefficient: 2 },
  { id: 'cs-6a-hist', classGroupId: '6a', subjectId: 'subj-hist', coefficient: 2 },
  { id: 'cs-6a-sci', classGroupId: '6a', subjectId: 'subj-sci', coefficient: 2 },
  { id: 'cs-6a-en', classGroupId: '6a', subjectId: 'subj-en', coefficient: 2 },
  { id: 'cs-6a-eps', classGroupId: '6a', subjectId: 'subj-eps', coefficient: 1 },
  { id: 'cs-6b-math', classGroupId: '6b', subjectId: 'subj-math', coefficient: 3 },
  { id: 'cs-6b-fr', classGroupId: '6b', subjectId: 'subj-fr', coefficient: 2 },
  { id: 'cs-5a-math', classGroupId: '5a', subjectId: 'subj-math', coefficient: 3 },
  { id: 'cs-5a-fr', classGroupId: '5a', subjectId: 'subj-fr', coefficient: 2 },
  { id: 'cs-5a-hist', classGroupId: '5a', subjectId: 'subj-hist', coefficient: 2 },
  { id: 'cs-5a-sci', classGroupId: '5a', subjectId: 'subj-sci', coefficient: 2 },
  { id: 'cs-5a-en', classGroupId: '5a', subjectId: 'subj-en', coefficient: 2 },
  { id: 'cs-5a-eps', classGroupId: '5a', subjectId: 'subj-eps', coefficient: 1 },
] as const satisfies readonly ClassSubjectInput[]
