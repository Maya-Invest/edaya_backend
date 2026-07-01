import type {
  StructureTemplateReportCardDomainCategory,
  StructureTemplateReportCardStructure,
} from "./types";

const FR_TRIMESTERS = [
  { code: "T1", name: "Trimestre 1", weight: 1 },
  { code: "T2", name: "Trimestre 2", weight: 1 },
  { code: "T3", name: "Trimestre 3", weight: 1 },
] as const;

const FR_SEMESTERS = [
  { code: "S1", name: "Semestre 1", weight: 1 },
  { code: "S2", name: "Semestre 2", weight: 1 },
] as const;

export const FR_COLLEGE_DOMAIN_CATEGORIES: StructureTemplateReportCardDomainCategory[] = [
  { domain: "Langues", label: "Langues", order: 1, coefficient: 2, weight: 2 },
  { domain: "Sciences", label: "Sciences", order: 2, coefficient: 2, weight: 2 },
  { domain: "Univers Social", label: "Humanités", order: 3, coefficient: 2, weight: 2 },
  { domain: "Développement Physique", label: "EPS", order: 4, coefficient: 1, weight: 1 },
];

export const FR_LYCEE_DOMAIN_CATEGORIES: StructureTemplateReportCardDomainCategory[] = [
  { domain: "Langues", label: "Langues", order: 1, coefficient: 2, weight: 2 },
  { domain: "Sciences", label: "Sciences", order: 2, coefficient: 3, weight: 3 },
  { domain: "Univers Social", label: "Humanités & philosophie", order: 3, coefficient: 2, weight: 2 },
  { domain: "Développement Physique", label: "EPS", order: 4, coefficient: 1, weight: 1 },
];

export function frCollegeReportCardStructure(): StructureTemplateReportCardStructure {
  return {
    gradingScale: 20,
    periods: [...FR_TRIMESTERS],
    passingGrade: 10,
    domainCategories: FR_COLLEGE_DOMAIN_CATEGORIES,
  };
}

export function frLyceeReportCardStructure(): StructureTemplateReportCardStructure {
  return {
    gradingScale: 20,
    periods: [...FR_SEMESTERS],
    passingGrade: 10,
    domainCategories: FR_LYCEE_DOMAIN_CATEGORIES,
  };
}
