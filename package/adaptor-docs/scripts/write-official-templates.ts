import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "templates");

const TEMPLATES = [
  { key: "schooling-certificate.v1", titleFr: "Certificat de scolarité", titleEn: "Schooling certificate", required: ["studentName", "schoolName", "schoolYear"] },
  { key: "enrollment-record.v1", titleFr: "Fiche d'inscription", titleEn: "Enrollment record", required: ["studentName", "schoolName", "schoolYear"] },
  { key: "student-id-card.v1", titleFr: "Carte d'élève", titleEn: "Student ID card", required: ["studentName", "schoolName"], layout: "id-card" },
  { key: "invoice.v1", titleFr: "Facture / avis d'échéance", titleEn: "Invoice / payment notice", required: ["studentName", "schoolName", "rows"] },
  { key: "receipt.v1", titleFr: "Quittance de paiement", titleEn: "Payment receipt", required: ["studentName", "schoolName", "paragraphs"] },
  { key: "settlement-quittance.v1", titleFr: "Quittance de solde", titleEn: "Settlement quittance", required: ["studentName", "schoolName", "rows"] },
  { key: "account-statement.v1", titleFr: "Relevé de compte élève", titleEn: "Student account statement", required: ["studentName", "schoolName", "rows"] },
  { key: "payment-reminder.v1", titleFr: "Relance de paiement", titleEn: "Payment reminder", required: ["studentName", "schoolName", "rows"] },
  { key: "withdrawal-certificate.v1", titleFr: "Certificat de radiation", titleEn: "Withdrawal certificate", required: ["studentName", "schoolName", "paragraphs"] },
  { key: "annual-transcript.v1", titleFr: "Relevé annuel", titleEn: "Annual transcript", required: ["studentName", "schoolName", "schoolYear", "rows"] },
  { key: "convocation.v1", titleFr: "Convocation", titleEn: "Convocation", required: ["studentName", "schoolName", "fields"] },
  { key: "class-timetable.v1", titleFr: "Emploi du temps de classe", titleEn: "Class timetable", required: ["schoolName", "classLabel", "rows"] },
  { key: "teacher-timetable.v1", titleFr: "Emploi du temps enseignant", titleEn: "Teacher timetable", required: ["schoolName", "rows"] },
  { key: "class-roster.v1", titleFr: "Liste de classe", titleEn: "Class roster", required: ["schoolName", "classLabel", "rows"] },
  { key: "attendance-sheet.v1", titleFr: "Feuille d'appel", titleEn: "Attendance sheet", required: ["schoolName", "classLabel", "rows"] },
  { key: "incident-report.v1", titleFr: "Rapport d'incident", titleEn: "Incident report", required: ["schoolName", "paragraphs"] },
] as const;

const letterHbs = `<!DOCTYPE html>
<html lang="{{locale}}">
  <head>
    <meta charset="utf-8" />
    <title>{{documentTitle}}</title>
    <style>
      :root { --brand: {{primaryColor}}; }
      {{{styles}}}
    </style>
  </head>
  <body class="{{#if watermark}}watermarked{{/if}}">
    {{#if watermark}}<div class="watermark">{{labels.preview}}</div>{{/if}}
    <header class="letter-header">
      {{#if logoUrl}}<img class="logo" src="{{logoUrl}}" alt="" />{{/if}}
      <div class="identity">
        <p class="school">{{schoolName}}</p>
        {{#if schoolCity}}<p>{{schoolCity}}</p>{{/if}}
        {{#if schoolAddress}}<p>{{schoolAddress}}</p>{{/if}}
        {{#if schoolPhone}}<p>{{schoolPhone}}</p>{{/if}}
        {{#if schoolEmail}}<p>{{schoolEmail}}</p>{{/if}}
      </div>
      {{#if photoUrl}}<img class="photo" src="{{photoUrl}}" alt="" />{{/if}}
    </header>
    <h1>{{#if documentTitle}}{{documentTitle}}{{else}}{{labels.documentTitle}}{{/if}}</h1>
    {{#if orderNumber}}<p class="number">{{labels.orderNumber}} {{orderNumber}}</p>{{/if}}
    {{#if studentName}}<p><strong>{{labels.student}}</strong> {{studentName}}</p>{{/if}}
    {{#if classLabel}}<p><strong>{{labels.class}}</strong> {{classLabel}}</p>{{/if}}
    {{#if schoolYear}}<p><strong>{{labels.schoolYear}}</strong> {{schoolYear}}</p>{{/if}}
    {{#if date}}<p><strong>{{labels.date}}</strong> {{date}}</p>{{/if}}
    {{#if matricule}}<p><strong>{{labels.matricule}}</strong> {{matricule}}</p>{{/if}}
    {{#if fields}}
      <dl class="fields">
        {{#each fields}}
          <dt>{{label}}</dt>
          <dd>{{value}}</dd>
        {{/each}}
      </dl>
    {{/if}}
    {{#if paragraphs}}
      {{#each paragraphs}}
        <p class="body">{{text}}</p>
      {{/each}}
    {{/if}}
    {{#if notes}}<p class="notes">{{notes}}</p>{{/if}}
    {{#if columns}}
      <table>
        <thead><tr>{{#each columns}}<th>{{this}}</th>{{/each}}</tr></thead>
        <tbody>
          {{#each rows}}
            <tr>{{#each cells}}<td>{{this}}</td>{{/each}}</tr>
          {{/each}}
        </tbody>
      </table>
    {{/if}}
    <footer>
      {{#if stampUrl}}<img class="stamp" src="{{stampUrl}}" alt="" />{{/if}}
      {{#if signatureUrl}}<img class="sign" src="{{signatureUrl}}" alt="" />{{/if}}
      <p class="generated">{{labels.generatedBy}}</p>
    </footer>
  </body>
</html>
`;

const idCardHbs = `<!DOCTYPE html>
<html lang="{{locale}}">
  <head>
    <meta charset="utf-8" />
    <title>{{documentTitle}}</title>
    <style>
      :root { --brand: {{primaryColor}}; }
      {{{styles}}}
    </style>
  </head>
  <body class="id-card {{#if watermark}}watermarked{{/if}}">
    {{#if watermark}}<div class="watermark">{{labels.preview}}</div>{{/if}}
    <article class="card">
      <div class="cut-marks"></div>
      {{#if logoUrl}}<img class="logo" src="{{logoUrl}}" alt="" />{{/if}}
      <p class="school">{{schoolName}}</p>
      {{#if photoUrl}}<img class="photo" src="{{photoUrl}}" alt="" />{{/if}}
      <h1>{{studentName}}</h1>
      {{#if classLabel}}<p>{{labels.class}} {{classLabel}}</p>{{/if}}
      {{#if matricule}}<p>{{labels.matricule}} {{matricule}}</p>{{/if}}
      {{#if schoolYear}}<p>{{labels.schoolYear}} {{schoolYear}}</p>{{/if}}
    </article>
  </body>
</html>
`;

const styles = `@page { size: A4 portrait; margin: 14mm; }
* { box-sizing: border-box; }
body { margin: 0; color: #1c2430; font-family: 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 11pt; line-height: 1.4; }
.watermarked { position: relative; }
.watermark { position: fixed; inset: 30% 0 auto; text-align: center; font-size: 48pt; color: rgba(180, 40, 40, 0.18); transform: rotate(-24deg); pointer-events: none; letter-spacing: 0.2em; }
.letter-header { display: flex; gap: 16px; align-items: center; border-bottom: 3px solid var(--brand, #1f4b7a); padding-bottom: 12px; margin-bottom: 16px; }
.logo, .photo { max-height: 72px; object-fit: contain; }
.photo { width: 72px; height: 90px; object-fit: cover; border: 1px solid #c5cdd8; }
.school { margin: 0; font-weight: 700; font-size: 14pt; color: var(--brand, #1f4b7a); }
h1 { font-size: 16pt; margin: 0 0 12px; }
.number { font-weight: 600; }
.fields { display: grid; grid-template-columns: 140px 1fr; gap: 4px 12px; }
.fields dt { font-weight: 600; }
.fields dd { margin: 0; }
table { width: 100%; border-collapse: collapse; margin-top: 12px; }
th, td { border: 1px solid #c5cdd8; padding: 6px 8px; text-align: left; font-size: 10pt; }
th { background: #eef3f8; }
.notes { margin-top: 12px; font-style: italic; }
footer { margin-top: 28px; display: flex; gap: 24px; align-items: flex-end; }
.stamp, .sign { max-height: 72px; }
.generated { margin-left: auto; font-size: 8pt; color: #667084; }
.id-card .card { width: 85mm; height: 54mm; border: 1px dashed #667084; padding: 8mm; position: relative; }
.id-card .photo { width: 24mm; height: 30mm; float: right; }
`;

function schema(key: string, _title: string, required: readonly string[]) {
  return {
    $schema: "http://json-schema.org/draft-07/schema#",
    $id: `https://edaya.local/templates/${key}/schema.json`,
    title: `${key} payload`,
    type: "object",
    required,
    additionalProperties: false,
    properties: {
      documentTitle: { type: "string" },
      schoolName: { type: "string", minLength: 1 },
      schoolYear: { type: "string" },
      schoolCity: { type: "string" },
      schoolAddress: { type: "string" },
      schoolPhone: { type: "string" },
      schoolEmail: { type: "string" },
      schoolCode: { type: "string" },
      logoUrl: { type: "string", minLength: 1 },
      crestUrl: { type: "string", minLength: 1 },
      stampUrl: { type: "string", minLength: 1 },
      signatureUrl: { type: "string", minLength: 1 },
      photoUrl: { type: "string", minLength: 1 },
      primaryColor: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" },
      studentName: { type: "string" },
      classLabel: { type: "string" },
      date: { type: "string" },
      orderNumber: { type: "string" },
      matricule: { type: "string" },
      notes: { type: "string" },
      watermark: { type: "boolean" },
      fields: {
        type: "array",
        items: {
          type: "object",
          required: ["label", "value"],
          additionalProperties: false,
          properties: { label: { type: "string" }, value: { type: "string" } },
        },
      },
      paragraphs: {
        type: "array",
        items: {
          type: "object",
          required: ["text"],
          additionalProperties: false,
          properties: { text: { type: "string" } },
        },
      },
      columns: { type: "array", items: { type: "string" } },
      rows: {
        type: "array",
        items: {
          type: "object",
          required: ["cells"],
          additionalProperties: false,
          properties: { cells: { type: "array", items: { type: "string" } } },
        },
      },
    },
  };
}

function constName(key: string) {
  return `${key.replaceAll(".", "_").replaceAll("-", "_").toUpperCase()}_ASSETS`;
}

for (const template of TEMPLATES) {
  const dir = join(root, template.key);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "manifest.json"), `${JSON.stringify({
    key: template.key,
    formats: ["pdf"],
    locales: ["fr", "en"],
    version: "1.0.0",
    title: { fr: template.titleFr, en: template.titleEn },
  }, null, 2)}\n`);
  writeFileSync(join(dir, "schema.json"), `${JSON.stringify(schema(template.key, template.titleEn, template.required), null, 2)}\n`);
  writeFileSync(join(dir, "styles.css"), styles);
  writeFileSync(join(dir, "template.hbs"), "layout" in template && template.layout === "id-card" ? idCardHbs : letterHbs);
  writeFileSync(join(dir, "assets.ts"), `/// <reference path="../../text-modules.d.ts" />
import type { TemplateAssets, TemplateManifest } from "../load-assets";
import manifestJson from "./manifest.json";
import schemaJson from "./schema.json";
import styles from "./styles.css";
import templateSpec from "./template.precompiled.js";

export const ${constName(template.key)}: TemplateAssets = {
  manifest: manifestJson as TemplateManifest,
  schema: schemaJson as object,
  templateSpec,
  styles,
};
`);
  console.log(`wrote ${template.key}`);
}
