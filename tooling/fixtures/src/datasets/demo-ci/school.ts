import type { AcademicPeriodInput, AcademicYearInput, ClassGroupInput, ClassSubjectInput, GradeLevelInput, PeriodDefinitionInput, SchoolInput, SubjectInput, SubjectMatterInput } from '@edaya/core'
import { AttendanceMode, DayOfWeek, defaultSubjectCategoryId, SubjectColor } from '@edaya/core'
import { IVORY_COAST_ONBOARDING_DATASET } from '../../onboarding/ivory-coast/parse-ivory-coast-templates'
import { classNameFromLabel } from '../../onboarding/registry'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../shared/ids'
import { buildCatalogSubjectMatters, ciCollegeSubjectMatterCatalog } from '../../shared/subject-matter-chapters'

export const demoCiSchool = {
  id: DEMO_CI_SCHOOL_ID,
  name: 'École Edaya — Cocody',
  financeCurrency: 'XOF',
  timeZone: 'Africa/Abidjan',
  city: 'Abidjan',
  country: 'Côte d\'Ivoire',
  timetableMinDayGapSameSubject: 1,
  issuingName: 'École Edaya — Cocody',
  postalAddress: 'Boulevard Latrille, Cocody, Abidjan',
  phone: '+225 27 22 44 00 00',
  email: 'secretariat@edaya-ci.test',
  schoolCode: 'EDAYA-CI',
} satisfies SchoolInput

export const demoCiAcademicYear = {
  id: DEMO_CI_ACADEMIC_YEAR_ID,
  schoolId: DEMO_CI_SCHOOL_ID,
  name: '2026 — 2027',
  startDate: '2026-09-14',
  endDate: '2027-07-09',
} satisfies AcademicYearInput

export const demoCiAcademicPeriods = [
  {
    id: 'ci-2025-t1',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Trimestre 1',
    startDate: '2026-09-14',
    endDate: '2026-12-18',
  },
  {
    id: 'ci-2025-t2',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Trimestre 2',
    startDate: '2027-01-04',
    endDate: '2027-03-26',
  },
  {
    id: 'ci-2025-t3',
    schoolId: DEMO_CI_SCHOOL_ID,
    academicYearId: DEMO_CI_ACADEMIC_YEAR_ID,
    name: 'Trimestre 3',
    startDate: '2027-04-12',
    endDate: '2027-07-09',
  },
] as const satisfies readonly AcademicPeriodInput[]

/** Niveaux du cycle collège (programme ivoirien). Les libellés sont ceux du template ci-college. */
export const demoCiGradeLevels = [
  { id: 'ci-gl-6', schoolId: DEMO_CI_SCHOOL_ID, name: 'Sixième', label: '6ème', cycle: 'Collège', order: 1 },
  { id: 'ci-gl-5', schoolId: DEMO_CI_SCHOOL_ID, name: 'Cinquième', label: '5ème', cycle: 'Collège', order: 2 },
  { id: 'ci-gl-4', schoolId: DEMO_CI_SCHOOL_ID, name: 'Quatrième', label: '4ème', cycle: 'Collège', order: 3 },
  { id: 'ci-gl-3', schoolId: DEMO_CI_SCHOOL_ID, name: 'Troisième', label: '3ème', cycle: 'Collège', order: 4 },
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

const demoCiLabelByGradeLevelId = new Map<string, string>(
  demoCiGradeLevels.map(level => [level.id, level.label]),
)

/** Aligne le seed sur l'onboarding : même racine (le libellé du niveau) et même mode par défaut. */
function demoCiClassName(gradeLevelId: string, index: number): string {
  const label = demoCiLabelByGradeLevelId.get(gradeLevelId)
  if (!label) {
    throw new Error(`Unknown demo-ci grade level: ${gradeLevelId}`)
  }
  return classNameFromLabel(label, index, 'numerical')
}

export const demoCiClassGroups = [
  { id: 'ci-6a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-6', name: demoCiClassName('ci-gl-6', 0), capacity: 35, homeroomStaffId: 'ci-st3', attendanceMode: AttendanceMode.Daily },
  { id: 'ci-6b', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-6', name: demoCiClassName('ci-gl-6', 1), capacity: 35, attendanceMode: AttendanceMode.Daily },
  { id: 'ci-5a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-5', name: demoCiClassName('ci-gl-5', 0), capacity: 35, homeroomStaffId: 'ci-st3', attendanceMode: AttendanceMode.Daily },
  { id: 'ci-4a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-4', name: demoCiClassName('ci-gl-4', 0), capacity: 35, attendanceMode: AttendanceMode.Daily },
  { id: 'ci-3a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-3', name: demoCiClassName('ci-gl-3', 0), capacity: 35, attendanceMode: AttendanceMode.Daily },
] as const satisfies readonly ClassGroupInput[]

function demoCiCategoryId(code: string): string {
  const category = IVORY_COAST_ONBOARDING_DATASET.subjectCategories.find(row => row.code === code)
  if (!category)
    throw new Error(`Unknown demo category: ${code}`)
  return defaultSubjectCategoryId(DEMO_CI_SCHOOL_ID, category.name)
}

/** Matières du collège ivoirien (cf. template ci-college). */
const demoCiSubjectTemplates = [
  { id: 'ci-subj-fr', schoolId: DEMO_CI_SCHOOL_ID, name: 'Français', code: 'FR', coefficient: 3, categoryId: demoCiCategoryId('LITERARY'), color: SubjectColor.Warm },
  { id: 'ci-subj-math', schoolId: DEMO_CI_SCHOOL_ID, name: 'Mathématiques', code: 'MATH', coefficient: 3, categoryId: demoCiCategoryId('SCIENTIFIC'), color: SubjectColor.Mint },
  { id: 'ci-subj-pc', schoolId: DEMO_CI_SCHOOL_ID, name: 'Physique-Chimie', code: 'PC', coefficient: 2, categoryId: demoCiCategoryId('SCIENTIFIC'), color: SubjectColor.Sky },
  { id: 'ci-subj-svt', schoolId: DEMO_CI_SCHOOL_ID, name: 'Sciences de la Vie et de la Terre', code: 'SVT', coefficient: 2, categoryId: demoCiCategoryId('SCIENTIFIC'), color: SubjectColor.Mint },
  { id: 'ci-subj-ang', schoolId: DEMO_CI_SCHOOL_ID, name: 'Anglais', code: 'ANG', coefficient: 2, categoryId: demoCiCategoryId('LANGUAGES'), color: SubjectColor.Sky },
  { id: 'ci-subj-hg', schoolId: DEMO_CI_SCHOOL_ID, name: 'Histoire-Géographie', code: 'HG', coefficient: 2, categoryId: demoCiCategoryId('HUMANITIES'), color: SubjectColor.Warm },
  { id: 'ci-subj-edhc', schoolId: DEMO_CI_SCHOOL_ID, name: 'Éducation aux Droits de l\'Homme et à la Citoyenneté', code: 'EDHC', coefficient: 1, categoryId: demoCiCategoryId('HUMANITIES'), color: SubjectColor.Warm },
  { id: 'ci-subj-eps', schoolId: DEMO_CI_SCHOOL_ID, name: 'Éducation Physique et Sportive', code: 'EPS', coefficient: 1, categoryId: demoCiCategoryId('SPORT'), color: SubjectColor.Mint },
] as const

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

/** Each grade owns independent subject and chapter IDs. Sixth-grade IDs stay readable in demo journeys. */
export function demoCiSubjectId(templateId: string, gradeLevelId: string): string {
  return gradeLevelId === 'ci-gl-6' ? templateId : `${templateId}-${gradeLevelId}`
}

export const demoCiSubjects = demoCiGradeLevels.flatMap((grade) => {
  const groupIds = new Set(demoCiClassGroups.filter(group => group.gradeLevelId === grade.id).map(group => group.id as string))
  return demoCiSubjectTemplates.filter(template => demoCiClassSubjectDefinitions.some(offering => groupIds.has(offering.classGroupId) && offering.subjectId === template.id)).map((template) => {
    const offering = demoCiClassSubjectDefinitions.find(row => groupIds.has(row.classGroupId) && row.subjectId === template.id)!
    return { ...template, id: demoCiSubjectId(template.id, grade.id), gradeLevelId: grade.id, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, coefficient: offering.coefficient, periodsPerWeek: template.code === 'MATH' ? 4 : Math.max(2, offering.coefficient + 1), ...(template.code === 'MATH' ? { minPeriodSpan: 1, maxPeriodSpan: 2 } : {}) }
  })
}) satisfies readonly SubjectInput[]

const demoCiChapterTemplates = buildCatalogSubjectMatters(
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

export const demoCiSubjectMatters = demoCiSubjects.flatMap((subject) => {
  const template = demoCiSubjectTemplates.find(row => row.code === subject.code)!
  return demoCiChapterTemplates.filter(chapter => chapter.subjectId === template.id).map(chapter => ({
    ...chapter,
    subjectId: subject.id,
    id: subject.gradeLevelId === 'ci-gl-6' ? chapter.id : `${chapter.id}-${subject.gradeLevelId}`,
  }))
}) satisfies readonly SubjectMatterInput[]

export const demoCiClassSubjects = demoCiClassGroups.flatMap(group => demoCiSubjects.filter(subject => subject.gradeLevelId === group.gradeLevelId).map((subject) => {
  const template = demoCiSubjectTemplates.find(row => row.code === subject.code)!
  const previous = demoCiClassSubjectDefinitions.find(row => row.classGroupId === group.id && row.subjectId === template.id)
  return { id: previous?.id ?? `ci-cs-${group.id.slice(3)}-${template.id.replace('ci-subj-', '')}`, classGroupId: group.id, subjectId: subject.id, coefficient: subject.coefficient, periodsPerWeek: subject.periodsPerWeek, minPeriodSpan: subject.minPeriodSpan, maxPeriodSpan: subject.maxPeriodSpan }
})) satisfies readonly ClassSubjectInput[]
