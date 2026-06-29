export type StructureModel = "college" | "lycee";

export type GradeLevelTemplateKey =
  | "gl-6"
  | "gl-5"
  | "gl-4"
  | "gl-3"
  | "gl-2"
  | "gl-1"
  | "gl-t";

export interface GradeLevelTemplate {
  key: GradeLevelTemplateKey;
  name: string;
  shortLabel: string;
  cycle: string;
  order: number;
  model: StructureModel;
}

export interface SubjectTemplate {
  key: string;
  code: string;
  name: string;
  defaultCoefficient: number;
  category: "Scientifique" | "Littéraire" | "Langues" | "Sciences humaines" | "Sport";
  color: "mint" | "sky" | "warm";
  matterName: string;
  matterDescription: string;
  estimatedHours: number;
}

export const COLLEGE_GRADE_LEVEL_KEYS: readonly GradeLevelTemplateKey[] = [
  "gl-6",
  "gl-5",
  "gl-4",
  "gl-3",
];

export const LYCEE_GRADE_LEVEL_KEYS: readonly GradeLevelTemplateKey[] = [
  "gl-2",
  "gl-1",
  "gl-t",
];

export const GRADE_LEVEL_TEMPLATES: Record<GradeLevelTemplateKey, GradeLevelTemplate> = {
  "gl-6": { key: "gl-6", name: "6ème", shortLabel: "6e", cycle: "Middle School", order: 1, model: "college" },
  "gl-5": { key: "gl-5", name: "5ème", shortLabel: "5e", cycle: "Middle School", order: 2, model: "college" },
  "gl-4": { key: "gl-4", name: "4ème", shortLabel: "4e", cycle: "Middle School", order: 3, model: "college" },
  "gl-3": { key: "gl-3", name: "3ème", shortLabel: "3e", cycle: "Middle School", order: 4, model: "college" },
  "gl-2": { key: "gl-2", name: "2nde", shortLabel: "2nde", cycle: "High School", order: 5, model: "lycee" },
  "gl-1": { key: "gl-1", name: "1ère", shortLabel: "1ère", cycle: "High School", order: 6, model: "lycee" },
  "gl-t": { key: "gl-t", name: "Terminale", shortLabel: "Terminale", cycle: "High School", order: 7, model: "lycee" },
};

export const BASE_SUBJECT_TEMPLATES: readonly SubjectTemplate[] = [
  {
    key: "math",
    code: "MATH",
    name: "Mathématiques",
    defaultCoefficient: 3,
    category: "Scientifique",
    color: "mint",
    matterName: "Programme de base",
    matterDescription: "Algèbre, géométrie et résolution de problèmes.",
    estimatedHours: 5,
  },
  {
    key: "fr",
    code: "FR",
    name: "Français",
    defaultCoefficient: 2,
    category: "Littéraire",
    color: "warm",
    matterName: "Programme de base",
    matterDescription: "Lecture, écriture et analyse de textes.",
    estimatedHours: 4,
  },
  {
    key: "hist",
    code: "HIST",
    name: "Histoire-Géographie",
    defaultCoefficient: 2,
    category: "Sciences humaines",
    color: "sky",
    matterName: "Programme de base",
    matterDescription: "Histoire et géographie du programme officiel.",
    estimatedHours: 3,
  },
  {
    key: "sci",
    code: "SCI",
    name: "Sciences",
    defaultCoefficient: 2,
    category: "Scientifique",
    color: "warm",
    matterName: "Programme de base",
    matterDescription: "Biologie, écologie et sciences de la Terre.",
    estimatedHours: 3,
  },
  {
    key: "en",
    code: "EN",
    name: "Anglais",
    defaultCoefficient: 2,
    category: "Langues",
    color: "sky",
    matterName: "Programme de base",
    matterDescription: "Compréhension, expression et culture.",
    estimatedHours: 3,
  },
  {
    key: "eps",
    code: "EPS",
    name: "EPS",
    defaultCoefficient: 1,
    category: "Sport",
    color: "mint",
    matterName: "Programme de base",
    matterDescription: "Activités physiques et bien-être.",
    estimatedHours: 2,
  },
];

const CLASS_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"] as const;

export function isGradeLevelTemplateKey(value: string): value is GradeLevelTemplateKey {
  return value in GRADE_LEVEL_TEMPLATES;
}

export function allowedTemplateKeysForModels(models: StructureModel[]): GradeLevelTemplateKey[] {
  const keys = new Set<GradeLevelTemplateKey>();
  for (const model of models) {
    const source = model === "college" ? COLLEGE_GRADE_LEVEL_KEYS : LYCEE_GRADE_LEVEL_KEYS;
    for (const key of source) {
      keys.add(key);
    }
  }
  return [...keys].sort(
    (left, right) => GRADE_LEVEL_TEMPLATES[left].order - GRADE_LEVEL_TEMPLATES[right].order,
  );
}

export function classDisplayName(templateKey: GradeLevelTemplateKey, index: number): string {
  const template = GRADE_LEVEL_TEMPLATES[templateKey];
  const letter = CLASS_LETTERS[index] ?? String(index + 1);
  return `${template.shortLabel} ${letter}`;
}
