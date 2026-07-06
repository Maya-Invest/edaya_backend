import type {
  AcademicPeriodInput,
  AcademicYearInput,
  ClassGroupInput,
  ClassSubjectInput,
  GradeLevelInput,
  PeriodDefinitionInput,
  SchoolInput,
  SubjectInput,
  SubjectMatterInput,
} from '@edaya/core'
import { SubjectCategory, SubjectColor } from '@edaya/core'
import { DEMO_CI_ACADEMIC_YEAR_ID, DEMO_CI_SCHOOL_ID } from '../../shared/ids'

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

export const demoCiPeriodDefinitions = [
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
] as const satisfies readonly PeriodDefinitionInput[]

export const demoCiClassGroups = [
  { id: 'ci-6a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-6', name: '6ème A', capacity: 35, homeroomStaffId: 'ci-st3' },
  { id: 'ci-6b', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-6', name: '6ème B', capacity: 35 },
  { id: 'ci-5a', schoolId: DEMO_CI_SCHOOL_ID, academicYearId: DEMO_CI_ACADEMIC_YEAR_ID, gradeLevelId: 'ci-gl-5', name: '5ème A', capacity: 35, homeroomStaffId: 'ci-st3' },
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

export const demoCiSubjectMatters = [
  { id: 'ci-sm-fr', subjectId: 'ci-subj-fr', name: 'Programme officiel', description: 'Lecture, grammaire et expression écrite selon le programme du MENA-CI.', sequenceOrder: 1, estimatedHours: 5 },
  { id: 'ci-sm-math', subjectId: 'ci-subj-math', name: 'Programme officiel', description: 'Arithmétique, géométrie plane et initiation aux probabilités.', sequenceOrder: 1, estimatedHours: 5 },
  { id: 'ci-sm-pc', subjectId: 'ci-subj-pc', name: 'Programme officiel', description: 'Forces, matière et électricité de base.', sequenceOrder: 1, estimatedHours: 3 },
  { id: 'ci-sm-svt', subjectId: 'ci-subj-svt', name: 'Programme officiel', description: 'Fonctionnement du corps humain et environnement ivoirien.', sequenceOrder: 1, estimatedHours: 3 },
  { id: 'ci-sm-ang', subjectId: 'ci-subj-ang', name: 'Programme officiel', description: 'Compréhension orale et écrite, vocabulaire scolaire.', sequenceOrder: 1, estimatedHours: 3 },
  { id: 'ci-sm-hg', subjectId: 'ci-subj-hg', name: 'Programme officiel', description: 'Histoire de l\'Afrique et géographie de la Côte d\'Ivoire.', sequenceOrder: 1, estimatedHours: 3 },
  { id: 'ci-sm-edhc', subjectId: 'ci-subj-edhc', name: 'Programme officiel', description: 'Citoyenneté, droits de l\'enfant et vie en société.', sequenceOrder: 1, estimatedHours: 2 },
  { id: 'ci-sm-eps', subjectId: 'ci-subj-eps', name: 'Programme officiel', description: 'Athlétisme, sports collectifs et éducation à la santé.', sequenceOrder: 1, estimatedHours: 2 },
] as const satisfies readonly SubjectMatterInput[]

export const demoCiClassSubjects = [
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
] as const satisfies readonly ClassSubjectInput[]
