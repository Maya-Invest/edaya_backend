import type { AcademicPeriodInput, AcademicYearInput, ClassGroupInput, ClassSubjectInput, GradeLevelInput, PeriodDefinitionInput, SchoolInput, SubjectInput, SubjectMatterInput } from '@edaya/core'
import { AttendanceMode, DayOfWeek, SubjectCategory, SubjectColor } from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../shared/ids'
import { buildCatalogSubjectMatters, ciCollegeSubjectMatterCatalog } from '../../shared/subject-matter-chapters'

export const demoCiSchool = {
  id: DEMO_CI_SCHOOL_ID,
  name: 'École Edaya — Cocody',
  timeZone: 'Africa/Abidjan',
  city: 'Abidjan',
  country: 'Côte d\'Ivoire',
} satisfies SchoolInput

export const demoCiAcademicYear = {
  id: DEMO_CI_ACADEMIC_YEAR_ID,
  schoolId: DEMO_CI_SCHOOL_ID,
  name: '2025 — 2026',
  startDate: '2025-09-15',
  endDate: '2026-07-10',
} satisfies AcademicYearInput

export const demoCiAcademicPeriods = [
  {
    id: 'ci-2025-t1',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Trimestre 1',
    startDate: '2025-09-15',
    endDate: '2025-12-19',
  },
  {
    id: 'ci-2025-t2',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Trimestre 2',
    startDate: '2026-01-05',
    endDate: '2026-03-27',
  },
  {
    id: 'ci-2025-t3',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Trimestre 3',
    startDate: '2026-04-14',
    endDate: '2026-07-10',
  },
] as const satisfies readonly AcademicPeriodInput[]

/** Niveaux du cycle collège (programme ivoirien). */
export const demoCiGradeLevels = [
  { id: 'ci-gl-6', schoolId: DEMO_CI_SCHOOL_ID, name: '6ème', cycle: 'Collège', order: 1 },
  { id: 'ci-gl-5', schoolId: DEMO_CI_SCHOOL_ID, name: '5ème', cycle: 'Collège', order: 2 },
  { id: 'ci-gl-4', schoolId: DEMO_CI_SCHOOL_ID, name: '4ème', cycle: 'Collège', order: 3 },
  { id: 'ci-gl-3', schoolId: DEMO_CI_SCHOOL_ID, name: '3ème', cycle: 'Collège', order: 4 },
] as const satisfies readonly GradeLevelInput[]

const demoCiDailyPeriodDefinitions = [
  { id: 'ci-pd-1', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 1', order: 1, startTime: '07:30', endTime: '08:15', isBreak: false },
  { id: 'ci-pd-2', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 2', order: 2, startTime: '08:15', endTime: '09:00', isBreak: false },
  { id: 'ci-pd-break-am', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Récréation', order: 3, startTime: '09:00', endTime: '09:15', isBreak: true },
  { id: 'ci-pd-3', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 3', order: 4, startTime: '09:15', endTime: '10:00', isBreak: false },
  { id: 'ci-pd-4', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 4', order: 5, startTime: '10:00', endTime: '10:45', isBreak: false },
  { id: 'ci-pd-5', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 5', order: 6, startTime: '10:45', endTime: '11:30', isBreak: false },
  { id: 'ci-pd-lunch', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Pause déjeuner', order: 7, startTime: '11:30', endTime: '13:00', isBreak: true },
  { id: 'ci-pd-6', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 6', order: 8, startTime: '13:00', endTime: '13:45', isBreak: false },
  { id: 'ci-pd-7', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 7', order: 9, startTime: '13:45', endTime: '14:30', isBreak: false },
  { id: 'ci-pd-break-pm', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Récréation', order: 10, startTime: '14:30', endTime: '14:45', isBreak: true },
  { id: 'ci-pd-8', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, label: 'Période 8', order: 11, startTime: '14:45', endTime: '15:30', isBreak: false },
] as const

const demoCiWeekdays = [DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday] as const

export const demoCiPeriodDefinitions = demoCiWeekdays.flatMap(dayOfWeek =>
  demoCiDailyPeriodDefinitions.map(period => ({
    ...period,
    id: dayOfWeek === DayOfWeek.Monday ? period.id : `${period.id}__${dayOfWeek}`,
    dayOfWeek,
    isTeachingSlot: true,
  }))) satisfies readonly PeriodDefinitionInput[]

export const demoCiClassGroups = [
  { id: 'ci-6a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-6', name: '6ème A', capacity: 35, homeroomStaffId: 'ci-st3', attendanceMode: AttendanceMode.Daily },
  { id: 'ci-6b', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-6', name: '6ème B', capacity: 35, attendanceMode: AttendanceMode.Daily },
  { id: 'ci-5a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-5', name: '5ème A', capacity: 35, homeroomStaffId: 'ci-st3' },
  { id: 'ci-4a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-4', name: '4ème A', capacity: 35 },
  { id: 'ci-3a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-3', name: '3ème A', capacity: 35 },
] as const satisfies readonly ClassGroupInput[]

/** Matières du collège ivoirien (cf. template ci-college). */
export const demoCiSubjects = [
  { id: 'ci-subj-fr', schoolId: DEMO_CI_SCHOOL_ID, name: 'Français', code: 'FR', defaultCoefficient: 3, category: SubjectCategory.Literary, color: SubjectColor.Warm },
  { id: 'ci-subj-math', schoolId: DEMO_CI_SCHOOL_ID, name: 'Mathématiques', code: 'MATH', defaultCoefficient: 3, category: SubjectCategory.Scientific, color: SubjectColor.Mint },
  { id: 'ci-subj-pc', schoolId: DEMO_CI_SCHOOL_ID, name: 'Physique-Chimie', code: 'PC', defaultCoefficient: 2, category: SubjectCategory.Scientific, color: SubjectColor.Sky },
  { id: 'ci-subj-svt', schoolId: DEMO_CI_SCHOOL_ID, name: 'Sciences de la Vie et de la Terre', code: 'SVT', defaultCoefficient: 2, category: SubjectCategory.Scientific, color: SubjectColor.Mint },
  { id: 'ci-subj-ang', schoolId: DEMO_CI_SCHOOL_ID, name: 'Anglais', code: 'ANG', defaultCoefficient: 2, category: SubjectCategory.Languages, color: SubjectColor.Sky },
  { id: 'ci-subj-hg', schoolId: DEMO_CI_SCHOOL_ID, name: 'Histoire-Géographie', code: 'HG', defaultCoefficient: 2, category: SubjectCategory.Humanities, color: SubjectColor.Warm },
  { id: 'ci-subj-edhc', schoolId: DEMO_CI_SCHOOL_ID, name: 'Éducation aux Droits de l\'Homme et à la Citoyenneté', code: 'EDHC', defaultCoefficient: 1, category: SubjectCategory.Humanities, color: SubjectColor.Warm },
  { id: 'ci-subj-eps', schoolId: DEMO_CI_SCHOOL_ID, name: 'Éducation Physique et Sportive', code: 'EPS', defaultCoefficient: 1, category: SubjectCategory.Sport, color: SubjectColor.Mint },
] as const satisfies readonly SubjectInput[]

export const demoCiSubjectMatters = buildCatalogSubjectMatters(
  ciCollegeSubjectMatterCatalog,
  {
    'ci-subj-fr': 'ci-sm-fr-',
    'ci-subj-math': 'ci-sm-math-',
    'ci-subj-pc': 'ci-sm-pc-',
    'ci-subj-svt': 'ci-sm-svt-',
    'ci-subj-ang': 'ci-sm-ang-',
    'ci-subj-hg': 'ci-sm-hg-',
    'ci-subj-edhc': 'ci-sm-edhc-',
    'ci-subj-eps': 'ci-sm-eps-',
  },
) satisfies readonly SubjectMatterInput[]

const demoCiClassSubjectDefinitions = [
  { id: 'ci-cs-6a-fr', classGroupId: 'ci-6a', subjectId: 'ci-subj-fr', coefficient: 3 },
  { id: 'ci-cs-6a-math', classGroupId: 'ci-6a', subjectId: 'ci-subj-math', coefficient: 2 },
  { id: 'ci-cs-6a-hg', classGroupId: 'ci-6a', subjectId: 'ci-subj-hg', coefficient: 2 },
  { id: 'ci-cs-6a-svt', classGroupId: 'ci-6a', subjectId: 'ci-subj-svt', coefficient: 2 },
  { id: 'ci-cs-6a-ang', classGroupId: 'ci-6a', subjectId: 'ci-subj-ang', coefficient: 2 },
  { id: 'ci-cs-6a-edhc', classGroupId: 'ci-6a', subjectId: 'ci-subj-edhc', coefficient: 1 },
  { id: 'ci-cs-6a-eps', classGroupId: 'ci-6a', subjectId: 'ci-subj-eps', coefficient: 1 },
  { id: 'ci-cs-6b-fr', classGroupId: 'ci-6b', subjectId: 'ci-subj-fr', coefficient: 3 },
  { id: 'ci-cs-6b-math', classGroupId: 'ci-6b', subjectId: 'ci-subj-math', coefficient: 2 },
  { id: 'ci-cs-6b-hg', classGroupId: 'ci-6b', subjectId: 'ci-subj-hg', coefficient: 2 },
  { id: 'ci-cs-6b-ang', classGroupId: 'ci-6b', subjectId: 'ci-subj-ang', coefficient: 2 },
  { id: 'ci-cs-6b-eps', classGroupId: 'ci-6b', subjectId: 'ci-subj-eps', coefficient: 1 },
  { id: 'ci-cs-5a-fr', classGroupId: 'ci-5a', subjectId: 'ci-subj-fr', coefficient: 3 },
  { id: 'ci-cs-5a-math', classGroupId: 'ci-5a', subjectId: 'ci-subj-math', coefficient: 2 },
  { id: 'ci-cs-5a-pc', classGroupId: 'ci-5a', subjectId: 'ci-subj-pc', coefficient: 2 },
  { id: 'ci-cs-5a-svt', classGroupId: 'ci-5a', subjectId: 'ci-subj-svt', coefficient: 2 },
  { id: 'ci-cs-5a-hg', classGroupId: 'ci-5a', subjectId: 'ci-subj-hg', coefficient: 2 },
  { id: 'ci-cs-5a-ang', classGroupId: 'ci-5a', subjectId: 'ci-subj-ang', coefficient: 2 },
  { id: 'ci-cs-5a-eps', classGroupId: 'ci-5a', subjectId: 'ci-subj-eps', coefficient: 1 },
  { id: 'ci-cs-4a-fr', classGroupId: 'ci-4a', subjectId: 'ci-subj-fr', coefficient: 3 },
  { id: 'ci-cs-4a-math', classGroupId: 'ci-4a', subjectId: 'ci-subj-math', coefficient: 2 },
  { id: 'ci-cs-4a-pc', classGroupId: 'ci-4a', subjectId: 'ci-subj-pc', coefficient: 2 },
  { id: 'ci-cs-4a-svt', classGroupId: 'ci-4a', subjectId: 'ci-subj-svt', coefficient: 2 },
  { id: 'ci-cs-4a-hg', classGroupId: 'ci-4a', subjectId: 'ci-subj-hg', coefficient: 2 },
  { id: 'ci-cs-4a-ang', classGroupId: 'ci-4a', subjectId: 'ci-subj-ang', coefficient: 2 },
  { id: 'ci-cs-4a-eps', classGroupId: 'ci-4a', subjectId: 'ci-subj-eps', coefficient: 1 },
  { id: 'ci-cs-3a-fr', classGroupId: 'ci-3a', subjectId: 'ci-subj-fr', coefficient: 3 },
  { id: 'ci-cs-3a-math', classGroupId: 'ci-3a', subjectId: 'ci-subj-math', coefficient: 2 },
  { id: 'ci-cs-3a-pc', classGroupId: 'ci-3a', subjectId: 'ci-subj-pc', coefficient: 2 },
  { id: 'ci-cs-3a-svt', classGroupId: 'ci-3a', subjectId: 'ci-subj-svt', coefficient: 2 },
  { id: 'ci-cs-3a-hg', classGroupId: 'ci-3a', subjectId: 'ci-subj-hg', coefficient: 2 },
  { id: 'ci-cs-3a-ang', classGroupId: 'ci-3a', subjectId: 'ci-subj-ang', coefficient: 2 },
  { id: 'ci-cs-3a-eps', classGroupId: 'ci-3a', subjectId: 'ci-subj-eps', coefficient: 1 },
] as const

export const demoCiClassSubjects = demoCiClassSubjectDefinitions.map(classSubject => ({
  ...classSubject,
  periodsPerWeek: Math.max(2, classSubject.coefficient + 1),
})) satisfies readonly ClassSubjectInput[]
