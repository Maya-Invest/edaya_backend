/** Grade scales from mock `report-cards.ts` `gradeScales[]`. */
export const SEED_GRADE_SCALES = [
  {
    id: 'gs-20',
    name: 'Sur 20',
    minScore: 0,
    maxScore: 20,
    isDefault: true,
    mockPassingScore: 10,
    mockDecimalPlaces: 2,
    mockDescription: 'Barème standard français — note sur 20, seuil de réussite à 10.',
    ranges: [
      { letter: 'D', minScore: 0, maxScore: 9.99, isPassing: false, interpretation: 'Insuffisant' },
      { letter: 'C', minScore: 10, maxScore: 13.99, isPassing: true, interpretation: 'Assez bien' },
      { letter: 'B', minScore: 14, maxScore: 15.99, isPassing: true, interpretation: 'Bien' },
      { letter: 'A', minScore: 16, maxScore: 20, isPassing: true, interpretation: 'Très bien' },
    ],
  },
  {
    id: 'gs-100',
    name: 'Sur 100',
    minScore: 0,
    maxScore: 100,
    isDefault: false,
    mockPassingScore: 50,
    mockDecimalPlaces: 1,
    mockDescription: 'Pourcentage ou centième — utilisé en sport ou projets transversaux.',
    ranges: [
      { letter: 'D', minScore: 0, maxScore: 49.99, isPassing: false, interpretation: 'Insuffisant' },
      { letter: 'C', minScore: 50, maxScore: 59.99, isPassing: true, interpretation: 'Passable' },
      { letter: 'B', minScore: 60, maxScore: 79.99, isPassing: true, interpretation: 'Satisfaisant' },
      { letter: 'A', minScore: 80, maxScore: 100, isPassing: true, interpretation: 'Excellent' },
    ],
  },
  {
    id: 'gs-lettres',
    name: 'Appréciations (A–D)',
    minScore: 0,
    maxScore: 4,
    isDefault: false,
    mockPassingScore: 2,
    mockDecimalPlaces: 0,
    mockDescription: 'A = Très bien · B = Bien · C = Assez bien · D = Insuffisant.',
    ranges: [
      { letter: 'D', minScore: 0, maxScore: 1.99, isPassing: false, interpretation: 'Insuffisant' },
      { letter: 'C', minScore: 2, maxScore: 2.49, isPassing: true, interpretation: 'Assez bien' },
      { letter: 'B', minScore: 2.5, maxScore: 3.49, isPassing: true, interpretation: 'Bien' },
      { letter: 'A', minScore: 3.5, maxScore: 4, isPassing: true, interpretation: 'Très bien' },
    ],
  },
] as const

export const SEED_REPORT_CARD_DEFINITION_MS6 = {
  id: 'rcd-ms-6',
  name: 'Bulletin trimestriel — Collège (6ème)',
  gradeLevelId: 'gl-6',
  gradeScaleId: 'gs-20',
  mockStatus: 'published' as const,
  isDefault: true,
  sections: [
    {
      id: 'rcs-ms-fond',
      name: 'Matières fondamentales',
      kind: 'group' as const,
      order: 1,
      weight: 2,
      mockKind: 'matieres' as const,
      mockCoefficient: 2,
      subjectIds: ['subj-math', 'subj-fr', 'subj-hist'],
    },
    {
      id: 'rcs-ms-sci',
      name: 'Sciences & langues',
      kind: 'group' as const,
      order: 2,
      weight: 2,
      mockKind: 'matieres' as const,
      mockCoefficient: 1.5,
      subjectIds: ['subj-sci', 'subj-en'],
    },
    {
      id: 'rcs-ms-sport',
      name: 'EPS & arts',
      kind: 'group' as const,
      order: 3,
      weight: 1,
      mockKind: 'matieres' as const,
      mockCoefficient: 1,
      subjectIds: ['subj-eps'],
    },
    {
      id: 'rcs-ms-synth',
      name: 'Synthèse trimestrielle',
      kind: 'group' as const,
      order: 4,
      weight: 0,
      mockKind: 'synthese' as const,
      subjectIds: [] as const,
    },
    {
      id: 'rcs-ms-appr',
      name: 'Appréciations',
      kind: 'group' as const,
      order: 5,
      weight: 0,
      mockKind: 'appreciation' as const,
      subjectIds: [] as const,
    },
  ],
} as const

export const SEED_REPORT_CARD_DEFINITION_TERM = {
  id: 'rcd-term',
  name: 'Bulletin semestriel — Terminale',
  gradeLevelId: 'gl-t',
  gradeScaleId: 'gs-20',
  mockStatus: 'published' as const,
  isDefault: true,
  sections: [
    {
      id: 'rcs-term-spé',
      name: 'Spécialités',
      kind: 'group' as const,
      order: 1,
      weight: 3,
      mockKind: 'matieres' as const,
      mockCoefficient: 3,
      subjectIds: ['subj-advmath', 'subj-phys'],
    },
    {
      id: 'rcs-term-synth',
      name: 'Moyennes & rang',
      kind: 'group' as const,
      order: 2,
      weight: 0,
      mockKind: 'synthese' as const,
      subjectIds: [] as const,
    },
    {
      id: 'rcs-term-appr',
      name: 'Appréciations & orientation',
      kind: 'group' as const,
      order: 3,
      weight: 0,
      mockKind: 'appreciation' as const,
      subjectIds: [] as const,
    },
  ],
} as const

/** Draft template for `/configuration/report-cards` — not used for results yet. */
export const SEED_REPORT_CARD_DEFINITION_MS_DRAFT = {
  id: 'rcd-ms-draft',
  name: 'Bulletin trimestriel — Collège (modèle brouillon)',
  gradeLevelId: 'gl-6',
  gradeScaleId: 'gs-20',
  mockStatus: 'draft' as const,
  isDefault: false,
  sections: [
    {
      id: 'rcs-draft-fond',
      name: 'Matières fondamentales',
      kind: 'group' as const,
      order: 1,
      weight: 2,
      mockKind: 'matieres' as const,
      mockCoefficient: 2,
      subjectIds: ['subj-math', 'subj-fr', 'subj-hist'],
    },
    {
      id: 'rcs-draft-appr',
      name: 'Appréciations',
      kind: 'group' as const,
      order: 2,
      weight: 0,
      mockKind: 'appreciation' as const,
      subjectIds: [] as const,
    },
  ],
} as const

export const SEED_REPORT_CARD_DEFINITIONS = [
  SEED_REPORT_CARD_DEFINITION_MS6,
  SEED_REPORT_CARD_DEFINITION_TERM,
  SEED_REPORT_CARD_DEFINITION_MS_DRAFT,
] as const

const STUDENTS_6A = ['s1', 's2', 's3', 's4', 's5', 's6'] as const

function make6aReportCard(
  studentId: string,
  periodId: '2025-t1' | '2025-t2' | '2025-t3',
  overallAverage: number,
  classRank: number,
  mockStatus: 'published' | 'generated',
  homeroomComment: string,
  generatedAt: string,
  publishedAt?: string,
) {
  const id = `rcr-${studentId}-${periodId.replace('2025-', '')}`
  return {
    id,
    studentId,
    classGroupId: '6a' as const,
    periodId,
    definitionId: 'rcd-ms-6' as const,
    gradeScaleId: 'gs-20' as const,
    mockStatus,
    overallAverage,
    classRank,
    classSize: 6,
    homeroomComment,
    generatedAt,
    ...(publishedAt ? { publishedAt } : {}),
    sectionMarks: {
      'rcs-ms-fond': [
        { subjectId: 'subj-math', average: overallAverage - 0.5, coefficient: 2, appreciation: 'Progression régulière.' },
        { subjectId: 'subj-fr', average: overallAverage - 1, coefficient: 2, appreciation: 'Travail satisfaisant.' },
      ],
      'rcs-ms-sci': [
        { subjectId: 'subj-sci', average: overallAverage, coefficient: 1.5, appreciation: 'Participation en TP.' },
      ],
    },
  }
}

/** Class 6a report card results — trimestre 1 (all students published). */
export const SEED_REPORT_CARD_RESULTS_6A_T1 = STUDENTS_6A.map((studentId, index) =>
  make6aReportCard(
    studentId,
    '2025-t1',
    16 - index * 0.8,
    index + 1,
    'published',
    'Bon début d\'année scolaire.',
    '2025-12-15',
    '2025-12-19',
  ),
)

/** Class 6a report card results — trimestre 2 (all students published). */
export const SEED_REPORT_CARD_RESULTS_6A_T2 = STUDENTS_6A.map((studentId, index) =>
  make6aReportCard(
    studentId,
    '2025-t2',
    15.5 - index * 0.7,
    index + 1,
    'published',
    'Progression continue au second trimestre.',
    '2026-03-28',
    '2026-04-03',
  ),
)

/** Class 6a report card results for period 2025-t3 (from mock `reportCardResults[]`). */
export const SEED_REPORT_CARD_RESULTS_6A = [
  {
    id: 'rcr-s1-t3',
    studentId: 's1',
    classGroupId: '6a',
    periodId: '2025-t3',
    definitionId: 'rcd-ms-6',
    gradeScaleId: 'gs-20',
    mockStatus: 'published' as const,
    overallAverage: 17.2,
    classRank: 1,
    classSize: 6,
    homeroomComment: 'Amélie fait partie des élèves les plus investies de la classe. Résultats constants et comportement exemplaire.',
    principalComment: 'Félicitations du conseil de classe. Tableau d\'honneur.',
    generatedAt: '2026-06-20',
    publishedAt: '2026-06-26',
    sectionMarks: {
      'rcs-ms-fond': [
        { subjectId: 'subj-math', average: 18.5, coefficient: 2, appreciation: 'Excellent — maîtrise remarquable de l\'algèbre.' },
        { subjectId: 'subj-fr', average: 16.0, coefficient: 2, appreciation: 'Expression claire, analyses pertinentes.' },
        { subjectId: 'subj-hist', average: 17.0, coefficient: 2, appreciation: 'Bon esprit de synthèse en géographie.' },
      ],
      'rcs-ms-sci': [
        { subjectId: 'subj-sci', average: 17.5, coefficient: 1.5, appreciation: 'Curiosité scientifique et rigueur en TP.' },
        { subjectId: 'subj-en', average: 16.5, coefficient: 1.5, appreciation: 'Participation active, oral fluide.' },
      ],
      'rcs-ms-sport': [
        { subjectId: 'subj-eps', average: 18.0, coefficient: 1, appreciation: 'Esprit d\'équipe et investissement exemplaire.' },
      ],
    },
  },
  {
    id: 'rcr-s2-t3',
    studentId: 's2',
    classGroupId: '6a',
    periodId: '2025-t3',
    definitionId: 'rcd-ms-6',
    gradeScaleId: 'gs-20',
    mockStatus: 'published' as const,
    overallAverage: 14.5,
    classRank: 4,
    classSize: 6,
    homeroomComment: 'Noah doit consolider son organisation personnelle pour le trimestre prochain.',
    principalComment: 'Encouragements — peut progresser avec un effort régulier.',
    generatedAt: '2026-06-20',
    publishedAt: '2026-06-26',
    sectionMarks: {
      'rcs-ms-fond': [
        { subjectId: 'subj-math', average: 14.0, coefficient: 2, appreciation: 'Progrès en algèbre, rester vigilant sur la rigueur.' },
        { subjectId: 'subj-fr', average: 13.5, coefficient: 2, appreciation: 'Devoirs parfois incomplets.' },
        { subjectId: 'subj-hist', average: 15.0, coefficient: 2, appreciation: 'Participation correcte.' },
      ],
      'rcs-ms-sci': [
        { subjectId: 'subj-sci', average: 14.5, coefficient: 1.5, appreciation: 'Résultats hétérogènes en sciences.' },
        { subjectId: 'subj-en', average: 15.5, coefficient: 1.5, appreciation: 'Bon niveau à l\'oral.' },
      ],
      'rcs-ms-sport': [
        { subjectId: 'subj-eps', average: 15.0, coefficient: 1, appreciation: 'Assiduité satisfaisante.' },
      ],
    },
  },
  {
    id: 'rcr-s3-t3',
    studentId: 's3',
    classGroupId: '6a',
    periodId: '2025-t3',
    definitionId: 'rcd-ms-6',
    gradeScaleId: 'gs-20',
    mockStatus: 'generated' as const,
    overallAverage: 12.1,
    classRank: 6,
    classSize: 6,
    homeroomComment: 'Mira doit renforcer son travail personnel et la régularité des devoirs.',
    generatedAt: '2026-06-22',
    sectionMarks: {
      'rcs-ms-fond': [
        { subjectId: 'subj-math', average: 11.0, coefficient: 2, appreciation: 'Difficultés en calcul, soutien recommandé.' },
        { subjectId: 'subj-fr', average: 12.5, coefficient: 2, appreciation: 'Peut mieux faire à l\'écrit.' },
        { subjectId: 'subj-hist', average: 13.0, coefficient: 2, appreciation: 'Efforts visibles en histoire.' },
      ],
      'rcs-ms-sci': [
        { subjectId: 'subj-sci', average: 11.5, coefficient: 1.5, appreciation: 'Compréhension fragile des notions clés.' },
        { subjectId: 'subj-en', average: 12.0, coefficient: 1.5, appreciation: 'Timide à l\'oral.' },
      ],
      'rcs-ms-sport': [
        { subjectId: 'subj-eps', average: 14.0, coefficient: 1, appreciation: 'Motivée en EPS.' },
      ],
    },
  },
  {
    id: 'rcr-s5-t3',
    studentId: 's5',
    classGroupId: '6a',
    periodId: '2025-t3',
    definitionId: 'rcd-ms-6',
    gradeScaleId: 'gs-20',
    mockStatus: 'published' as const,
    overallAverage: 18.4,
    classRank: 2,
    classSize: 6,
    homeroomComment: 'Yuki est un modèle pour ses camarades. Résultats et attitude irréprochables.',
    principalComment: 'Tableau d\'honneur avec félicitations du conseil de classe.',
    generatedAt: '2026-06-20',
    publishedAt: '2026-06-26',
    sectionMarks: {
      'rcs-ms-fond': [
        { subjectId: 'subj-math', average: 19.0, coefficient: 2, appreciation: 'Maîtrise exceptionnelle.' },
        { subjectId: 'subj-fr', average: 18.0, coefficient: 2, appreciation: 'Style élégant, analyses fines.' },
        { subjectId: 'subj-hist', average: 18.5, coefficient: 2, appreciation: 'Culture générale remarquable.' },
      ],
      'rcs-ms-sci': [
        { subjectId: 'subj-sci', average: 18.0, coefficient: 1.5, appreciation: 'Excellente méthode expérimentale.' },
        { subjectId: 'subj-en', average: 17.5, coefficient: 1.5, appreciation: 'Expression orale très assurée.' },
      ],
      'rcs-ms-sport': [
        { subjectId: 'subj-eps', average: 19.0, coefficient: 1, appreciation: 'Performance sportive au top.' },
      ],
    },
  },
] as const

export const SEED_REPORT_CARD_RESULTS_TERM = [
  {
    id: 'rcr-s9-t1',
    studentId: 's9',
    classGroupId: 'term-s',
    periodId: '2025-t1',
    definitionId: 'rcd-term',
    gradeScaleId: 'gs-20',
    mockStatus: 'published' as const,
    overallAverage: 15.8,
    classRank: 2,
    classSize: 2,
    homeroomComment: 'Bon démarrage en spécialité maths.',
    generatedAt: '2025-12-14',
    publishedAt: '2025-12-19',
    sectionMarks: {
      'rcs-term-spé': [
        { subjectId: 'subj-advmath', average: 16.0, coefficient: 3, appreciation: 'Solides bases.' },
      ],
    },
  },
  {
    id: 'rcr-s10-t1',
    studentId: 's10',
    classGroupId: 'term-s',
    periodId: '2025-t1',
    definitionId: 'rcd-term',
    gradeScaleId: 'gs-20',
    mockStatus: 'published' as const,
    overallAverage: 16.5,
    classRank: 1,
    classSize: 2,
    homeroomComment: 'Excellente assiduité.',
    generatedAt: '2025-12-14',
    publishedAt: '2025-12-19',
    sectionMarks: {
      'rcs-term-spé': [
        { subjectId: 'subj-advmath', average: 17.0, coefficient: 3, appreciation: 'Très bon niveau.' },
      ],
    },
  },
  {
    id: 'rcr-s9-t3',
    studentId: 's9',
    classGroupId: 'term-s',
    periodId: '2025-t3',
    definitionId: 'rcd-term',
    gradeScaleId: 'gs-20',
    mockStatus: 'published' as const,
    overallAverage: 16.2,
    classRank: 3,
    classSize: 2,
    homeroomComment: 'Éliot aborde le bac avec sérieux et méthode.',
    principalComment: 'Parcours cohérent vers les études scientifiques.',
    generatedAt: '2026-06-18',
    publishedAt: '2026-06-25',
    sectionMarks: {
      'rcs-term-spé': [
        { subjectId: 'subj-advmath', average: 17.0, coefficient: 3, appreciation: 'Solide en analyse.' },
        { subjectId: 'subj-phys', average: 15.8, coefficient: 3, appreciation: 'Bon raisonnement en PC.' },
      ],
    },
  },
] as const

export const SEED_REPORT_CARD_RESULTS = [
  ...SEED_REPORT_CARD_RESULTS_6A_T1,
  ...SEED_REPORT_CARD_RESULTS_6A_T2,
  ...SEED_REPORT_CARD_RESULTS_6A,
  ...SEED_REPORT_CARD_RESULTS_TERM,
] as const
