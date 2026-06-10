import { subjects as ALL_SUBJECTS } from '$lib/data/school';

export type LogEntry = {
  id: string;
  date: string;
  subject: string;
  teacher: string;
  chapter: string;
  content: string;
  objectives: string[];
  homework?: string;
  attachments?: string[];
  progress: number;
};

export const SEED_BY_SUBJECT: Record<string, Omit<LogEntry, "id" | "date" | "subject" | "teacher">[]> = {
  Mathematics: [
    { chapter: "Ch. 6 — Fractions", content: "Addition et soustraction de fractions à dénominateurs différents. Exercices guidés au tableau.", objectives: ["Mettre au même dénominateur", "Simplifier le résultat"], homework: "Manuel p.84 ex. 12 à 18", attachments: ["fiche-fractions.pdf"], progress: 62 },
    { chapter: "Ch. 6 — Fractions", content: "Multiplication de fractions. Travail en binôme sur situations concrètes.", objectives: ["Multiplier deux fractions", "Interpréter le produit"], homework: "Cahier d'exercices p.27", progress: 66 },
    { chapter: "Ch. 7 — Géométrie", content: "Introduction aux triangles : nature, propriétés et constructions à la règle et au compas.", objectives: ["Identifier les triangles", "Construire avec précision"], attachments: ["constructions.pdf"], progress: 70 },
  ],
  "French Literature": [
    { chapter: "Séquence 4 — Fables", content: "Lecture analytique de « Le Loup et l'Agneau » de La Fontaine. Repérage des procédés.", objectives: ["Identifier la morale", "Analyser le dialogue"], homework: "Apprendre la fable par cœur", progress: 58 },
    { chapter: "Séquence 4 — Fables", content: "Atelier d'écriture : rédiger une fable contemporaine respectant la structure classique.", objectives: ["Structurer un récit court", "Soigner la morale"], progress: 61 },
  ],
  "History & Geography": [
    { chapter: "Ch. 3 — Grèce antique", content: "La cité d'Athènes au Ve siècle av. J.-C. : institutions et vie quotidienne.", objectives: ["Comprendre la démocratie athénienne"], homework: "Lire pp. 52-55 et répondre aux questions", attachments: ["carte-athenes.pdf"], progress: 48 },
  ],
  "Natural Sciences": [
    { chapter: "Ch. 5 — La cellule", content: "TP microscope : observation de cellules d'épiderme d'oignon. Schéma légendé.", objectives: ["Manipuler un microscope", "Réaliser un schéma scientifique"], attachments: ["protocole-tp.pdf", "fiche-schema.pdf"], progress: 55 },
  ],
  English: [
    { chapter: "Unit 6 — Travel", content: "Vocabulary on transports and directions. Role-play at the train station.", objectives: ["Ask for directions", "Use prepositions of place"], homework: "Workbook p.42 ex. A-C", progress: 64 },
  ],
  "Physical Education": [
    { chapter: "Cycle 3 — Athlétisme", content: "Séance course de demi-fond : gestion de l'allure sur 6 minutes.", objectives: ["Tenir une allure régulière"], progress: 50 },
  ],
};

export const ISO_DATES = ["2026-05-22", "2026-05-21", "2026-05-20", "2026-05-19", "2026-05-18", "2026-05-15", "2026-05-14"];

export function buildEntries(classId: string): LogEntry[] {
  const classSubjects = ALL_SUBJECTS.filter((s) => s.classId === classId);
  const out: LogEntry[] = [];
  let i = 0;
  for (const sub of classSubjects) {
    const seeds = SEED_BY_SUBJECT[sub.name] ?? [
      { chapter: "Séance", content: `Séance de ${sub.name}. Travail en classe et reprise des notions clés.`, objectives: ["Consolider les acquis"], progress: 50 },
    ];
    seeds.forEach((seed, k) => {
      out.push({
        id: `${sub.id}-${k}`,
        date: ISO_DATES[(i + k) % ISO_DATES.length],
        subject: sub.name,
        teacher: sub.teacher,
        ...seed,
      });
      i++;
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getSubjectEntries(subjectName: string): LogEntry[] {
  const seeds = SEED_BY_SUBJECT[subjectName] ?? [
    { chapter: "Séance", content: `Séance de ${subjectName}. Travail en classe et reprise des notions clés.`, objectives: ["Consolider les acquis"], progress: 50 },
  ];
  const sub = ALL_SUBJECTS.find((s) => s.name === subjectName);
  return seeds.map((seed, k) => ({
    id: `${sub?.id ?? subjectName}-${k}`,
    date: ISO_DATES[k % ISO_DATES.length],
    subject: subjectName,
    teacher: sub?.teacher ?? "",
    ...seed,
  })).sort((a, b) => (a.date < b.date ? 1 : -1));
}
