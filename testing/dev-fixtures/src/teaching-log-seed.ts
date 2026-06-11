/** Teaching journal entries from mock `teachingLog.ts`. No domain entity yet. */

export interface TeachingLogSeedEntry {
  id: string
  classGroupId: string
  subjectId: string
  subjectName: string
  teacher: string
  date: string
  chapter: string
  content: string
  objectives: string[]
  homework?: string
  attachments?: string[]
  progress: number
}

const ISO_DATES = ['2026-05-22', '2026-05-21', '2026-05-20', '2026-05-19', '2026-05-18', '2026-05-15', '2026-05-14'] as const

const SEED_BY_SUBJECT: Record<string, Omit<TeachingLogSeedEntry, 'id' | 'date' | 'subjectName' | 'teacher' | 'classGroupId' | 'subjectId'>[]> = {
  'Mathematics': [
    { chapter: 'Ch. 6 — Fractions', content: 'Addition et soustraction de fractions à dénominateurs différents. Exercices guidés au tableau.', objectives: ['Mettre au même dénominateur', 'Simplifier le résultat'], homework: 'Manuel p.84 ex. 12 à 18', attachments: ['fiche-fractions.pdf'], progress: 62 },
    { chapter: 'Ch. 6 — Fractions', content: 'Multiplication de fractions. Travail en binôme sur situations concrètes.', objectives: ['Multiplier deux fractions', 'Interpréter le produit'], homework: 'Cahier d\'exercices p.27', progress: 66 },
    { chapter: 'Ch. 7 — Géométrie', content: 'Introduction aux triangles : nature, propriétés et constructions à la règle et au compas.', objectives: ['Identifier les triangles', 'Construire avec précision'], attachments: ['constructions.pdf'], progress: 70 },
  ],
  'French Literature': [
    { chapter: 'Séquence 4 — Fables', content: 'Lecture analytique de « Le Loup et l\'Agneau » de La Fontaine. Repérage des procédés.', objectives: ['Identifier la morale', 'Analyser le dialogue'], homework: 'Apprendre la fable par cœur', progress: 58 },
    { chapter: 'Séquence 4 — Fables', content: 'Atelier d\'écriture : rédiger une fable contemporaine respectant la structure classique.', objectives: ['Structurer un récit court', 'Soigner la morale'], progress: 61 },
  ],
  'History & Geography': [
    { chapter: 'Ch. 3 — Grèce antique', content: 'La cité d\'Athènes au Ve siècle av. J.-C. : institutions et vie quotidienne.', objectives: ['Comprendre la démocratie athénienne'], homework: 'Lire pp. 52-55 et répondre aux questions', attachments: ['carte-athenes.pdf'], progress: 48 },
  ],
  'Natural Sciences': [
    { chapter: 'Ch. 5 — La cellule', content: 'TP microscope : observation de cellules d\'épiderme d\'oignon. Schéma légendé.', objectives: ['Manipuler un microscope', 'Réaliser un schéma scientifique'], attachments: ['protocole-tp.pdf', 'fiche-schema.pdf'], progress: 55 },
  ],
  'English': [
    { chapter: 'Unit 6 — Travel', content: 'Vocabulary on transports and directions. Role-play at the train station.', objectives: ['Ask for directions', 'Use prepositions of place'], homework: 'Workbook p.42 ex. A-C', progress: 64 },
  ],
  'Physical Education': [
    { chapter: 'Cycle 3 — Athlétisme', content: 'Séance course de demi-fond : gestion de l\'allure sur 6 minutes.', objectives: ['Tenir une allure régulière'], progress: 50 },
  ],
  'Advanced Mathematics': [
    { chapter: 'Ch. 8 — Calcul différentiel', content: 'Dérivées et interprétation graphique. Exercices sur les tangentes.', objectives: ['Calculer une dérivée', 'Interpréter la pente'], homework: 'Série 8 ex. 1-10', progress: 72 },
    { chapter: 'Ch. 9 — Algèbre linéaire', content: 'Systèmes d\'équations et matrices 2×2.', objectives: ['Résoudre un système', 'Manipuler une matrice'], progress: 68 },
  ],
  'Physics & Chemistry': [
    { chapter: 'Ch. 4 — Mécanique', content: 'Lois de Newton appliquées à des systèmes simples.', objectives: ['Modéliser une force', 'Appliquer ΣF = ma'], attachments: ['fiche-forces.pdf'], progress: 60 },
  ],
}

const CLASS_SUBJECTS: { classGroupId: string, subjectId: string, subjectName: string, teacher: string }[] = [
  { classGroupId: '6a', subjectId: 'sub1', subjectName: 'Mathematics', teacher: 'Mme Dupont' },
  { classGroupId: '6a', subjectId: 'sub2', subjectName: 'French Literature', teacher: 'M. Garnier' },
  { classGroupId: '6a', subjectId: 'sub3', subjectName: 'History & Geography', teacher: 'Mme Léon' },
  { classGroupId: '6a', subjectId: 'sub4', subjectName: 'Natural Sciences', teacher: 'M. Adler' },
  { classGroupId: '6a', subjectId: 'sub5', subjectName: 'English', teacher: 'Ms. Hart' },
  { classGroupId: '6a', subjectId: 'sub6', subjectName: 'Physical Education', teacher: 'M. Roux' },
  { classGroupId: 'term-s', subjectId: 'sub7', subjectName: 'Advanced Mathematics', teacher: 'M. Cheng' },
  { classGroupId: 'term-s', subjectId: 'sub8', subjectName: 'Physics & Chemistry', teacher: 'Mme Ortiz' },
]

function defaultSeeds(subjectName: string) {
  return [{
    chapter: 'Séance',
    content: `Séance de ${subjectName}. Travail en classe et reprise des notions clés.`,
    objectives: ['Consolider les acquis'],
    progress: 50,
  }]
}

function buildSeedEntries(): TeachingLogSeedEntry[] {
  const out: TeachingLogSeedEntry[] = []
  let dateIndex = 0

  for (const subject of CLASS_SUBJECTS) {
    const seeds = SEED_BY_SUBJECT[subject.subjectName] ?? defaultSeeds(subject.subjectName)
    seeds.forEach((seed, index) => {
      out.push({
        id: `${subject.subjectId}-${index}`,
        classGroupId: subject.classGroupId,
        subjectId: subject.subjectId,
        subjectName: subject.subjectName,
        teacher: subject.teacher,
        date: ISO_DATES[(dateIndex + index) % ISO_DATES.length] ?? ISO_DATES[0],
        ...seed,
      })
    })
    dateIndex += seeds.length
  }

  return out.sort((a, b) => (a.date < b.date ? 1 : -1))
}

export const SEED_TEACHING_LOG_ENTRIES = buildSeedEntries()
