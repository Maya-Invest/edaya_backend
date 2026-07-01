import type { StructureTemplateDefinition } from "./types";
import { frCollegeReportCardStructure, frLyceeReportCardStructure } from "./report-card-structure";

const FR_BASE_SUBJECTS: StructureTemplateDefinition["subjects"] = [
  { code: "MATH", shortName: "Mathématiques", domain: "Sciences", defaultCoefficient: 3 },
  { code: "FR", shortName: "Français", domain: "Langues", defaultCoefficient: 2 },
  { code: "HIST", shortName: "Histoire-Géographie", domain: "Univers Social", defaultCoefficient: 2 },
  { code: "SCI", shortName: "Sciences", domain: "Sciences", defaultCoefficient: 2 },
  { code: "EN", shortName: "Anglais", domain: "Langues", defaultCoefficient: 2 },
  { code: "EPS", shortName: "EPS", domain: "Développement Physique", defaultCoefficient: 1 },
];

const FR_BASE_CURRICULUM = FR_BASE_SUBJECTS.map(subject => ({
  levelCodes: [] as string[],
  subjectCode: subject.code,
  coefficient: subject.defaultCoefficient,
  matters: ["Programme de base"],
}));

export const FRANCE_STRUCTURE_TEMPLATES: readonly StructureTemplateDefinition[] = [
  {
    id: "fr-college",
    countryCode: "FR",
    label: "France — Collège",
    description: "Collège français (6e à 3e)",
    cycle: "Collège",
    reportCardStructure: frCollegeReportCardStructure(),
    gradeLevels: [
      { id: "fr-college:6EME", code: "6EME", name: "6ème", shortLabel: "6e", order: 1 },
      { id: "fr-college:5EME", code: "5EME", name: "5ème", shortLabel: "5e", order: 2 },
      { id: "fr-college:4EME", code: "4EME", name: "4ème", shortLabel: "4e", order: 3 },
      { id: "fr-college:3EME", code: "3EME", name: "3ème", shortLabel: "3e", order: 4 },
    ],
    subjects: FR_BASE_SUBJECTS,
    curriculum: FR_BASE_CURRICULUM,
  },
  {
    id: "fr-lycee",
    countryCode: "FR",
    label: "France — Lycée",
    description: "Lycée français (2nde à Terminale)",
    cycle: "Lycée",
    reportCardStructure: frLyceeReportCardStructure(),
    gradeLevels: [
      { id: "fr-lycee:2NDE", code: "2NDE", name: "2nde", shortLabel: "2nde", order: 1 },
      { id: "fr-lycee:1ERE", code: "1ERE", name: "1ère", shortLabel: "1ère", order: 2 },
      { id: "fr-lycee:TLE", code: "TLE", name: "Terminale", shortLabel: "Terminale", order: 3 },
    ],
    subjects: [
      ...FR_BASE_SUBJECTS,
      { code: "PHILO", shortName: "Philosophie", domain: "Univers Social", defaultCoefficient: 2 },
      { code: "PC", shortName: "Physique-Chimie", domain: "Sciences", defaultCoefficient: 3 },
    ],
    curriculum: [
      ...FR_BASE_CURRICULUM,
      { levelCodes: [], subjectCode: "PHILO", coefficient: 2, matters: ["Programme de base"] },
      { levelCodes: [], subjectCode: "PC", coefficient: 3, matters: ["Programme de base"] },
    ],
  },
];
