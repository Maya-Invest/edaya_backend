import type { SubjectMatterInput } from '@edaya/core'

export interface SubjectMatterChapterSeed {
  idSuffix: string
  name: string
  description: string
  sequenceOrder: number
  estimatedHours: number
}

export function buildSubjectMattersForSubject(
  subjectId: string,
  idPrefix: string,
  chapters: readonly SubjectMatterChapterSeed[],
): SubjectMatterInput[] {
  return chapters.map(chapter => ({
    id: `${idPrefix}${chapter.idSuffix}`,
    subjectId,
    name: chapter.name,
    description: chapter.description,
    sequenceOrder: chapter.sequenceOrder,
    estimatedHours: chapter.estimatedHours,
  }))
}

/** Collège ivoirien — chapitres réalistes pour les écrans Enseignement / cahier. */
export const ciCollegeSubjectMatterCatalog = {
  'ci-subj-fr': [
    { idSuffix: 'lecture', name: 'Compréhension de textes', description: 'Lecture analytique, résumé et questions de compréhension.', sequenceOrder: 1, estimatedHours: 6 },
    { idSuffix: 'grammaire', name: 'Grammaire : analyse et classes de mots', description: 'Nature et fonction des mots, phrase simple et complexe.', sequenceOrder: 2, estimatedHours: 5 },
    { idSuffix: 'ecriture', name: 'Production écrite', description: 'Rédaction narrative et argumentative guidée.', sequenceOrder: 3, estimatedHours: 5 },
    { idSuffix: 'orthographe', name: 'Orthographe lexicale', description: 'Accords, homophones et enrichissement du vocabulaire.', sequenceOrder: 4, estimatedHours: 4 },
  ],
  'ci-subj-math': [
    { idSuffix: 'nombres', name: 'Nombres entiers et décimaux', description: 'Opérations, priorités et problèmes contextualisés.', sequenceOrder: 1, estimatedHours: 6 },
    { idSuffix: 'fractions', name: 'Fractions et proportions', description: 'Fractions irréductibles, pourcentages et proportionnalité.', sequenceOrder: 2, estimatedHours: 6 },
    { idSuffix: 'geometrie', name: 'Figures planes et constructions', description: 'Triangles, cercles, symétries et instruments de géométrie.', sequenceOrder: 3, estimatedHours: 5 },
    { idSuffix: 'statistiques', name: 'Organisation et traitement de données', description: 'Tableaux, diagrammes et moyennes simples.', sequenceOrder: 4, estimatedHours: 4 },
  ],
  'ci-subj-pc': [
    { idSuffix: 'matiere', name: 'États de la matière', description: 'Solides, liquides, gaz et changements d\'état.', sequenceOrder: 1, estimatedHours: 4 },
    { idSuffix: 'electricite', name: 'Circuits électriques simples', description: 'Sources, conducteurs et sécurité en laboratoire.', sequenceOrder: 2, estimatedHours: 4 },
    { idSuffix: 'mouvement', name: 'Mouvement et forces', description: 'Vitesse, trajectoire et actions mécaniques.', sequenceOrder: 3, estimatedHours: 4 },
  ],
  'ci-subj-svt': [
    { idSuffix: 'nutrition', name: 'Digestion et nutrition', description: 'Aliments, nutriments et équilibre alimentaire.', sequenceOrder: 1, estimatedHours: 4 },
    { idSuffix: 'reproduction', name: 'Reproduction humaine', description: 'Puberté, cycle de vie et hygiène corporelle.', sequenceOrder: 2, estimatedHours: 4 },
    { idSuffix: 'environnement', name: 'Écosystèmes ivoiriens', description: 'Forêt, savane et gestion durable des ressources.', sequenceOrder: 3, estimatedHours: 3 },
  ],
  'ci-subj-ang': [
    { idSuffix: 'school', name: 'School life', description: 'Daily routines, classroom language and polite forms.', sequenceOrder: 1, estimatedHours: 4 },
    { idSuffix: 'people', name: 'Describing people and places', description: 'Adjectives, prepositions and short oral presentations.', sequenceOrder: 2, estimatedHours: 4 },
    { idSuffix: 'past', name: 'Talking about the past', description: 'Simple past events, dates and school memories.', sequenceOrder: 3, estimatedHours: 3 },
  ],
  'ci-subj-hg': [
    { idSuffix: 'afrique', name: 'L\'Afrique des origines à nos jours', description: 'Grands royaumes, colonisation et indépendances.', sequenceOrder: 1, estimatedHours: 5 },
    { idSuffix: 'civ', name: 'Territoire ivoirien', description: 'Relief, climat, villes et activités économiques.', sequenceOrder: 2, estimatedHours: 5 },
    { idSuffix: 'citoyennete', name: 'Vivre ensemble en Côte d\'Ivoire', description: 'Institutions locales, diversité culturelle et cohésion.', sequenceOrder: 3, estimatedHours: 3 },
  ],
  'ci-subj-edhc': [
    { idSuffix: 'droits', name: 'Droits de l\'enfant', description: 'Droits fondamentaux, devoirs et protection.', sequenceOrder: 1, estimatedHours: 3 },
    { idSuffix: 'citoyennete', name: 'Citoyenneté et institutions', description: 'République, symboles nationaux et participation.', sequenceOrder: 2, estimatedHours: 3 },
  ],
  'ci-subj-eps': [
    { idSuffix: 'athletisme', name: 'Athlétisme scolaire', description: 'Course, saut et lancer — techniques de base.', sequenceOrder: 1, estimatedHours: 3 },
    { idSuffix: 'collectifs', name: 'Sports collectifs', description: 'Football et handball : règles et esprit d\'équipe.', sequenceOrder: 2, estimatedHours: 3 },
    { idSuffix: 'sante', name: 'Éducation à la santé', description: 'Échauffement, hydratation et prévention des blessures.', sequenceOrder: 3, estimatedHours: 2 },
  ],
} as const satisfies Record<string, readonly SubjectMatterChapterSeed[]>

/** Ottawa central demo — chapter titles for teaching progress UI. */
export const centralSubjectMatterCatalog = {
  'subj-math': [
    { idSuffix: 'numbers', name: 'Number systems', description: 'Integers, rationals and order of operations.', sequenceOrder: 1, estimatedHours: 6 },
    { idSuffix: 'algebra', name: 'Introduction to algebra', description: 'Expressions, equations and word problems.', sequenceOrder: 2, estimatedHours: 6 },
    { idSuffix: 'geometry', name: 'Plane geometry', description: 'Angles, triangles and area calculations.', sequenceOrder: 3, estimatedHours: 5 },
    { idSuffix: 'data', name: 'Data and probability', description: 'Charts, mean/median and simple experiments.', sequenceOrder: 4, estimatedHours: 4 },
  ],
  'subj-fr': [
    { idSuffix: 'reading', name: 'Reading comprehension', description: 'Short stories, inference and vocabulary in context.', sequenceOrder: 1, estimatedHours: 5 },
    { idSuffix: 'grammar', name: 'Grammar and syntax', description: 'Sentence structure, tenses and agreement.', sequenceOrder: 2, estimatedHours: 5 },
    { idSuffix: 'writing', name: 'Written expression', description: 'Paragraphs, essays and peer review.', sequenceOrder: 3, estimatedHours: 4 },
  ],
  'subj-hist': [
    { idSuffix: 'antiquity', name: 'Ancient civilizations', description: 'Greece, Rome and their legacies.', sequenceOrder: 1, estimatedHours: 5 },
    { idSuffix: 'medieval', name: 'Medieval Europe', description: 'Feudalism, trade routes and culture.', sequenceOrder: 2, estimatedHours: 5 },
    { idSuffix: 'geography', name: 'World geography', description: 'Maps, climate zones and human settlements.', sequenceOrder: 3, estimatedHours: 4 },
  ],
  'subj-sci': [
    { idSuffix: 'cells', name: 'Living cells', description: 'Microscopy, organelles and cell division.', sequenceOrder: 1, estimatedHours: 4 },
    { idSuffix: 'ecology', name: 'Ecosystems', description: 'Food webs, biodiversity and conservation.', sequenceOrder: 2, estimatedHours: 4 },
    { idSuffix: 'physics', name: 'Forces and motion', description: 'Speed, friction and simple machines.', sequenceOrder: 3, estimatedHours: 4 },
  ],
  'subj-en': [
    { idSuffix: 'communication', name: 'Everyday communication', description: 'Greetings, requests and classroom English.', sequenceOrder: 1, estimatedHours: 4 },
    { idSuffix: 'culture', name: 'Culture and media', description: 'Short films, articles and discussion.', sequenceOrder: 2, estimatedHours: 3 },
  ],
  'subj-eps': [
    { idSuffix: 'fitness', name: 'Fitness fundamentals', description: 'Warm-up, endurance and flexibility.', sequenceOrder: 1, estimatedHours: 3 },
    { idSuffix: 'team-sports', name: 'Team sports', description: 'Basketball and soccer rules and tactics.', sequenceOrder: 2, estimatedHours: 3 },
  ],
  'subj-advmath': [
    { idSuffix: 'limits', name: 'Limits and continuity', description: 'Formal limits and graphical interpretation.', sequenceOrder: 1, estimatedHours: 8 },
    { idSuffix: 'derivatives', name: 'Derivatives', description: 'Rules, tangents and optimisation problems.', sequenceOrder: 2, estimatedHours: 8 },
    { idSuffix: 'integrals', name: 'Integrals', description: 'Antiderivatives and area under curves.', sequenceOrder: 3, estimatedHours: 8 },
  ],
  'subj-phys': [
    { idSuffix: 'mechanics', name: 'Mechanics', description: 'Kinematics, dynamics and energy.', sequenceOrder: 1, estimatedHours: 6 },
    { idSuffix: 'waves', name: 'Waves and optics', description: 'Sound, light and interference.', sequenceOrder: 2, estimatedHours: 6 },
    { idSuffix: 'chemistry', name: 'Organic chemistry basics', description: 'Hydrocarbons, functional groups and reactions.', sequenceOrder: 3, estimatedHours: 6 },
  ],
} as const satisfies Record<string, readonly SubjectMatterChapterSeed[]>

export function buildCatalogSubjectMatters(
  catalog: Record<string, readonly SubjectMatterChapterSeed[]>,
  idPrefixBySubjectId: Record<string, string>,
): SubjectMatterInput[] {
  return Object.entries(catalog).flatMap(([subjectId, chapters]) =>
    buildSubjectMattersForSubject(
      subjectId,
      idPrefixBySubjectId[subjectId] ?? `${subjectId}-sm-`,
      chapters,
    ),
  )
}
