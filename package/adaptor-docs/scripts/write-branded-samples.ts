import { Buffer } from "node:buffer";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { listTemplateDefinitions } from "../src/templates/registry";
import { EXAMPLE_ANNUAL_RENDER_REQUEST } from "../tests/annual-example";
import { EXAMPLE_LOGBOOK_RENDER_REQUEST, EXAMPLE_RENDER_REQUEST } from "../tests/examples";

const brandingDir = resolve(import.meta.dir, "../../../tooling/fixtures/assets/branding");
const outDir = resolve(import.meta.dir, "../../../docs/sprints/v1/evidence/branded-samples");

function dataUri(fileName: string): string {
  const bytes = readFileSync(resolve(brandingDir, fileName));
  return `data:image/jpeg;base64,${Buffer.from(bytes).toString("base64")}`;
}

const identity = {
  schoolName: "École EDaya — Cocody",
  schoolCity: "Abidjan",
  schoolAddress: "Boulevard Latrille, Cocody, Abidjan",
  schoolPhone: "+225 27 22 44 00 00",
  schoolEmail: "secretariat@edaya-ci.test",
  schoolCode: "EDAYA-CI",
  primaryColor: "#1f4b7a",
};

const assets = {
  logoUrl: dataUri("logo.jpg"),
  crestUrl: dataUri("crest.jpg"),
  stampUrl: dataUri("stamp.jpg"),
  signatureUrl: dataUri("signature.jpg"),
  photoUrl: dataUri("portrait.jpg"),
};

const ASSET_SLOTS: Record<string, readonly (keyof typeof assets)[]> = {
  "annual-report-card.v1": ["logoUrl", "crestUrl", "stampUrl", "signatureUrl", "photoUrl"],
  "report-card.v1": ["logoUrl", "crestUrl", "stampUrl", "signatureUrl", "photoUrl"],
  "logbook.v1": ["logoUrl"],
  "schooling-certificate.v1": ["logoUrl", "stampUrl", "signatureUrl"],
  "enrollment-record.v1": ["logoUrl", "photoUrl"],
  "student-id-card.v1": ["logoUrl", "photoUrl"],
  "invoice.v1": ["logoUrl", "stampUrl"],
  "receipt.v1": ["logoUrl", "stampUrl"],
  "settlement-quittance.v1": ["logoUrl", "stampUrl"],
  "account-statement.v1": ["logoUrl"],
  "payment-reminder.v1": ["logoUrl"],
  "withdrawal-certificate.v1": ["logoUrl", "stampUrl", "signatureUrl"],
  "annual-transcript.v1": ["logoUrl", "crestUrl"],
  "convocation.v1": ["logoUrl", "stampUrl"],
  "class-timetable.v1": ["logoUrl"],
  "teacher-timetable.v1": ["logoUrl"],
  "class-roster.v1": ["logoUrl"],
  "attendance-sheet.v1": ["logoUrl"],
  "incident-report.v1": ["logoUrl"],
};

function assetsFor(key: string): Partial<typeof assets> {
  const slots = ASSET_SLOTS[key] ?? ["logoUrl"];
  return Object.fromEntries(slots.map(slot => [slot, assets[slot]]));
}

const letterPayload = {
  ...identity,
  studentName: "Yao Marie-Claire",
  classLabel: "6ème A",
  schoolYear: "2025-2026",
  date: "15/09/2026",
  orderNumber: "EDAYA-2025-000012",
  matricule: "EDAYA-001",
  notes: "Les visuels d'émission (logo, cachet, signature) sont figés sur ce document.",
  paragraphs: [{ text: "Document d'échantillon avec identité d'émission et visuels officiels de l'établissement." }],
  fields: [
    { label: "Classe", value: "6ème A" },
    { label: "Année", value: "2025-2026" },
  ],
  columns: ["Libellé", "Montant"],
  rows: [
    { cells: ["Scolarité T1", "60 000 XOF"] },
    { cells: ["Transport T1", "15 000 XOF"] },
    { cells: ["Total reçu", "75 000 XOF"] },
  ],
};

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? { ...(value as Record<string, unknown>) } : {};
}

function payloadValue(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}

function payloadFor(key: string): unknown {
  const selected = assetsFor(key);
  if (key === "annual-report-card.v1") {
    const annual = EXAMPLE_ANNUAL_RENDER_REQUEST.payload;
    return { ...annual, ...identity, ...selected, council: { ...asObject(annual.council), principalStampUrl: assets.stampUrl } };
  }
  if (key === "annual-transcript.v1") {
    const annual = EXAMPLE_ANNUAL_RENDER_REQUEST.payload;
    const periods = annual.periods as Array<{ label: string; average: string }>;
    return {
      ...identity,
      ...selected,
      studentName: annual.studentName,
      classLabel: annual.classLabel,
      schoolYear: annual.schoolYear,
      date: annual.date,
      matricule: annual.matricule,
      columns: ["Période", "Moyenne / 20"],
      rows: periods.map(period => ({ cells: [period.label, period.average] })),
    };
  }
  if (key === "report-card.v1") {
    const bulletin = asObject(EXAMPLE_RENDER_REQUEST.payload);
    const council = { ...asObject(payloadValue(bulletin, "council")), principalStampUrl: assets.stampUrl };
    return {
      ...bulletin,
      ...identity,
      ...selected,
      council,
    };
  }
  if (key === "logbook.v1") {
    return {
      ...asObject(EXAMPLE_LOGBOOK_RENDER_REQUEST.payload),
      ...identity,
      ...selected,
    };
  }
  return { ...letterPayload, ...selected };
}

mkdirSync(outDir, { recursive: true });

const written: string[] = [];
const requestedKeys = process.argv.slice(2);
for (const template of listTemplateDefinitions()) {
  if (requestedKeys.length && !requestedKeys.includes(template.key))
    continue;
  const html = template.compileHtml("fr", payloadFor(template.key));
  const file = resolve(outDir, `${template.key}.html`);
  writeFileSync(file, html);
  written.push(file);
  console.log(template.key, html.length);
}

writeFileSync(resolve(outDir, "index.json"), `${JSON.stringify(listTemplateDefinitions().map(template => `${template.key}.html`), null, 2)}\n`);
console.log(`wrote ${written.length} html files to ${outDir}`);
