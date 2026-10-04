import { Buffer } from "node:buffer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createChromePdfRenderer, detectChromeExecutable, renderDocument } from "../src/index";
import { EXAMPLE_ANNUAL_RENDER_REQUEST } from "../tests/annual-example";

const directory = resolve(import.meta.dir, "../../../docs/sprints/v1/evidence/annual-report-card");
const branding = resolve(import.meta.dir, "../../../tooling/fixtures/assets/branding");
const image = (name: string) => `data:image/jpeg;base64,${Buffer.from(readFileSync(resolve(branding, name))).toString("base64")}`;
const renderer = createChromePdfRenderer(detectChromeExecutable()!);
const names = ["French", "English", "History and geography", "Mathematics", "Life and earth sciences", "Physics and chemistry", "Physical education", "Visual arts"];
mkdirSync(directory, { recursive: true });

// Explicit period matrices make semester, zero, unavailable and multipage examples reproducible.
for (const locale of ["fr", "en"] as const) {
  for (const variant of ["trimesters", "semesters", "multipage"] as const) {
    const format = (value: number | undefined) => value === undefined ? "—" : new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
    const count = variant === "semesters" ? 2 : 3;
    const weights = variant === "trimesters" ? [1, 1, 1] : variant === "semesters" ? [1, 3] : [1, 2, 3];
    const base = EXAMPLE_ANNUAL_RENDER_REQUEST.payload;
    const originals = base.subjects.filter(row => row.kind === "subject");
    const seeds = Array.from({ length: variant === "multipage" ? 40 : originals.length }, (_, index) => {
      const original = originals[index % originals.length]!;
      const grades: Array<number | undefined> = original.periodAverages.slice(0, count).map(value => Number(value.replace(",", ".")));
      if (variant !== "trimesters" && index === 0)
        grades[0] = 0;
      if (variant !== "trimesters" && index === 1)
        grades[0] = undefined;
      const coefficient = Number(original.coefficient);
      const totalWeight = grades.reduce<number>((sum, grade, period) => sum + (grade === undefined ? 0 : weights[period]!), 0);
      const average = totalWeight ? Math.round(grades.reduce<number>((sum, grade, period) => sum + (grade ?? 0) * weights[period]!, 0) / totalWeight * 100) / 100 : undefined;
      return { name: variant === "multipage"
        ? `${index + 1}. ${locale === "fr" ? "Sciences, technologie et développement durable — étude approfondie des systèmes naturels et de leurs interactions" : "Science, technology and sustainable development — advanced study of natural systems and their interactions"}`
        : locale === "fr" ? original.name : names[index]!, coefficient, grades, average, teacher: "teacherName" in original ? String(original.teacherName) : undefined };
    });
    const mean = (rows: typeof seeds, period?: number) => {
      const eligible = rows.filter(row => (period === undefined ? row.average : row.grades[period]) !== undefined);
      return eligible.reduce((sum, row) => sum + (period === undefined ? row.average! : row.grades[period]!) * row.coefficient, 0)
        / eligible.reduce((sum, row) => sum + row.coefficient, 0);
    };
    const row = (seed: typeof seeds[number]) => ({ name: seed.name, kind: "subject", periodAverages: seed.grades.map(format), average: format(seed.average), coefficient: String(seed.coefficient), total: format(seed.average === undefined ? undefined : seed.average * seed.coefficient), rank: "16 / 32", appreciation: locale === "fr" ? "Travail régulier" : "Steady work", teacherName: seed.teacher });
    const grouped = (name: string, rows: typeof seeds) => {
      const average = Math.round(mean(rows) * 100) / 100;
      const coefficient = rows.reduce((sum, seed) => sum + seed.coefficient, 0);
      return { name, kind: "bilan", periodAverages: weights.map((_, index) => format(mean(rows, index))), average: format(average), coefficient: String(coefficient), total: format(average * coefficient) };
    };

    const annual = Math.round(mean(seeds) * 100) / 100;
    const coefficient = seeds.reduce((sum, seed) => sum + seed.coefficient, 0);
    const payload = {
      ...base,
      documentTitle: locale === "fr" ? "Bulletin annuel" : "Annual report card",
      periodLabel: locale === "fr" ? "Année complète" : "Full school year",
      crestUrl: image("crest.jpg"),
      logoUrl: image("logo.jpg"),
      photoUrl: image("portrait.jpg"),
      signatureUrl: image("signature.jpg"),
      periods: weights.map((weight, index) => ({ id: `period-${index}`, label: locale === "fr" ? `${index + 1}${index === 0 ? "er" : "ème"} ${count === 2 ? "Semestre" : "Trimestre"}` : `${count === 2 ? "Semester" : "Term"} ${index + 1}`, weight: String(weight), average: format(mean(seeds, index)) })),
      subjects: [
        ...seeds.slice(0, 3).map(row),
        grouped(locale === "fr" ? "BILAN LETTRES" : "LANGUAGES SUMMARY", seeds.slice(0, 3)),
        ...seeds.slice(3).map(row),
        grouped(locale === "fr" ? "BILAN SCIENCES" : "SCIENCES SUMMARY", seeds.slice(3)),
        { name: locale === "fr" ? "MOYENNE GÉNÉRALE" : "OVERALL AVERAGE", kind: "totals", periodAverages: weights.map((_, index) => format(mean(seeds, index))), average: format(annual), coefficient: String(coefficient), total: format(seeds.reduce((sum, seed) => sum + (seed.average ?? 0) * seed.coefficient, 0)) },
      ],
      semesterAverage: `${format(annual)} / 20`,
      semesterRank: locale === "fr" ? "16è / 32 élèves" : "16 / 32 students",
      classResults: { classAverage: format(annual), lowestAverage: format(annual - 1.5), highestAverage: format(annual + 1.5) },
      council: { ...base.council, appreciation: locale === "fr" ? base.council.appreciation : "A satisfactory year. Steady progress in every subject.", principalStampUrl: image("stamp.jpg"), mentions: base.council.mentions.map((mention, index) => ({ ...mention, label: locale === "fr" ? mention.label : ["Congratulations", "Encouragement", "Honour roll", "Warning"][index]! })) },
    };
    const result = await renderDocument({ templateKey: "annual-report-card.v1", locale, payload }, { pdfRenderer: renderer });
    if (result.kind === "failure")
      throw new Error(result.message);
    writeFileSync(resolve(directory, `${variant}-${locale}.pdf`), result.value.bytes);
    writeFileSync(resolve(directory, `${variant}-${locale}.json`), `${JSON.stringify(payload, null, 2)}\n`);
    console.log(`${variant}-${locale}: ${result.value.bytes.length} bytes`);
  }
}
