import type { RenderDocumentRequest } from "../src/types";

const periods = ["1er Trimestre", "2ème Trimestre", "3ème Trimestre"];
const seeds = [
  { name: "Français", coefficient: 3, averages: [13, 14, 15], teacherName: "TRAORE M." },
  { name: "Anglais", coefficient: 2, averages: [12, 14, 16], teacherName: "KOFFI B." },
  { name: "Histoire-Géographie", coefficient: 2, averages: [11, 12, 13], teacherName: "DIABATE D." },
  { name: "Mathématiques", coefficient: 4, averages: [12, 14, 16], teacherName: "BAMBA E." },
  { name: "Sciences de la vie et de la Terre", coefficient: 3, averages: [14, 15, 16], teacherName: "OUATTARA F." },
  { name: "Physique-Chimie", coefficient: 3, averages: [10, 12, 14], teacherName: "KOUASSI A." },
  { name: "Éducation physique et sportive", coefficient: 1, averages: [15, 16, 17], teacherName: "YAO G." },
  { name: "Arts plastiques", coefficient: 1, averages: [13, 14, 15], teacherName: "KONE H." },
];
const format = (value: number): string => value.toFixed(2).replace(".", ",");
const totalCoefficient = seeds.reduce((sum, row) => sum + row.coefficient, 0);
const overall = (index: number): number => seeds.reduce((sum, row) => sum + row.averages[index]! * row.coefficient, 0) / totalCoefficient;
interface SampleRow {
  name: string;
  kind: "subject" | "bilan";
  periodAverages: string[];
  average: string;
  coefficient: string;
  total: string;
  rank?: string;
  appreciation?: string;
  teacherName?: string;
}
function subjectRow(row: typeof seeds[number]): SampleRow {
  const average = row.averages.reduce((sum, value) => sum + value, 0) / row.averages.length;
  return {
    name: row.name,
    kind: "subject",
    periodAverages: row.averages.map(format),
    average: format(average),
    coefficient: String(row.coefficient),
    total: format(average * row.coefficient),
    rank: "16 / 32",
    appreciation: "Travail régulier",
    teacherName: row.teacherName,
  };
}
function groupRow(name: string, rows: typeof seeds): SampleRow {
  const coefficient = rows.reduce((sum, row) => sum + row.coefficient, 0);
  const means = periods.map((_, index) => rows.reduce((sum, row) => sum + row.averages[index]! * row.coefficient, 0) / coefficient);
  const average = Math.round(means.reduce((sum, value) => sum + value, 0) / means.length * 100) / 100;
  return { name, kind: "bilan", periodAverages: means.map(format), average: format(average), coefficient: String(coefficient), total: format(average * coefficient) };
}
const annualAverage = periods.reduce((sum, _, index) => sum + overall(index), 0) / periods.length;

const peerAverages = Array.from({ length: 31 }, (_, index) => annualAverage + (index - 15) / 10);
const classAverages = [annualAverage, ...peerAverages];
const annualRank = 1 + peerAverages.filter(value => value > annualAverage).length;

/** Academic sample values are explicit and internally consistent; no finance fallback. */
export const EXAMPLE_ANNUAL_RENDER_REQUEST = {
  templateKey: "annual-report-card.v1",
  locale: "fr",
  options: { orientation: "landscape" },
  payload: {
    republicLabel: "RÉPUBLIQUE DE CÔTE D'IVOIRE",
    ministryLabel: "MINISTÈRE DE L'ÉDUCATION NATIONALE",
    documentTitle: "Bulletin annuel",
    schoolYear: "2025-2026",
    periodLabel: "Année complète",
    schoolName: "École Edaya — Cocody",
    schoolCity: "Abidjan",
    primaryColor: "#1f4b7a",
    studentName: "Yao Marie-Claire",
    matricule: "EDAYA-001",
    classLabel: "6ème A",
    birthDate: "04/09/2013",
    classSize: "32",
    date: "30/06/2026",
    orderNumber: "ANNUALBU-2025-2026-000001",
    periods: periods.map((label, index) => ({ id: `period-${index}`, label, weight: "1", average: format(overall(index)) })),
    subjects: [
      ...seeds.slice(0, 3).map(subjectRow),
      groupRow("BILAN LETTRES", seeds.slice(0, 3)),
      ...seeds.slice(3, 6).map(subjectRow),
      groupRow("BILAN SCIENCES", seeds.slice(3, 6)),
      ...seeds.slice(6).map(subjectRow),
      { name: "MOYENNE GÉNÉRALE", kind: "totals", periodAverages: periods.map((_, index) => format(overall(index))), average: format(annualAverage), coefficient: String(totalCoefficient), total: format(annualAverage * totalCoefficient) },
    ],
    semesterAverage: `${format(annualAverage)} / 20`,
    semesterRank: `${annualRank}è / 32 élèves`,
    classResults: { classAverage: format(classAverages.reduce((sum, value) => sum + value, 0) / classAverages.length), lowestAverage: format(Math.min(...classAverages)), highestAverage: format(Math.max(...classAverages)) },
    attendance: { absenceHoursTotal: "8", absenceHoursJustified: "6", absenceHoursUnjustified: "2" },
    council: { mentions: [{ label: "Félicitations", checked: false }, { label: "Encouragements", checked: true }, { label: "Tableau d’honneur", checked: false }, { label: "Avertissement", checked: false }], appreciation: "Année satisfaisante. Des progrès réguliers dans toutes les disciplines.", homeroomTeacherName: "TRAORE M.", signedAt: "Abidjan, le 30/06/2026" },
    motto: "Travail - Discipline - Rigueur",
    notice: "Document scolaire officiel à conserver.",
  },
} satisfies RenderDocumentRequest;
