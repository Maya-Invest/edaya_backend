import { describe, expect, test } from "bun:test";
import { getTemplateDefinition, listTemplateDefinitions } from "../src/templates/registry";
import { createRecordingPdfRenderer } from "./recording-renderer";
import { renderDocument } from "../src/services/render-document";

const LETTER_PAYLOAD = {
  schoolName: "Collège Edaya Cocody",
  studentName: "Yao Marie-Claire",
  classLabel: "6ème A",
  schoolYear: "2025-2026",
  date: "15/09/2026",
  orderNumber: "CERT-2025-000001",
  matricule: "EDAYA-001",
  notes: "Dépôt non imputé : 20 000 XOF. Ce dépôt ne solde pas toutes les charges.",
  paragraphs: [{ text: "Reçu 120 000 XOF. Cette quittance ne déclare pas que toutes les charges sont soldées." }],
  fields: [{ label: "Classe", value: "6ème A" }],
  columns: ["Libellé", "Reste"],
  rows: [
    { cells: ["Scolarité", "60 000 XOF"] },
    { cells: ["Transport", "0 XOF"] },
    ...Array.from({ length: 24 }, (_, index) => ({
      cells: [`Ligne ${index + 1} — Yao Marie-Claire N'Guessan-Kouamé`, `${(index + 1) * 1_000} XOF`],
    })),
  ],
  watermark: true,
};

describe("official template catalog A–E", () => {
  test("registers every Plan 04 template", () => {
    expect(listTemplateDefinitions().map(template => template.key).sort()).toEqual([
      "account-statement.v1",
      "annual-transcript.v1",
      "attendance-sheet.v1",
      "class-roster.v1",
      "class-timetable.v1",
      "convocation.v1",
      "enrollment-record.v1",
      "incident-report.v1",
      "invoice.v1",
      "logbook.v1",
      "payment-reminder.v1",
      "receipt.v1",
      "report-card.v1",
      "schooling-certificate.v1",
      "settlement-quittance.v1",
      "student-id-card.v1",
      "teacher-timetable.v1",
      "withdrawal-certificate.v1",
    ]);
  });

  test("compiles representative payloads including accents and optional assets", () => {
    for (const key of [
      "schooling-certificate.v1",
      "enrollment-record.v1",
      "student-id-card.v1",
      "invoice.v1",
      "receipt.v1",
      "settlement-quittance.v1",
      "account-statement.v1",
      "payment-reminder.v1",
      "withdrawal-certificate.v1",
      "annual-transcript.v1",
      "convocation.v1",
      "class-timetable.v1",
      "teacher-timetable.v1",
      "class-roster.v1",
      "attendance-sheet.v1",
      "incident-report.v1",
    ]) {
      const template = getTemplateDefinition(key);
      expect(template).not.toBeNull();
      const html = template!.compileHtml("fr", LETTER_PAYLOAD);
      expect(html).toContain("Collège Edaya Cocody");
      expect(html).toContain("Yao Marie-Claire");
    }
  });

  test("embeds issuing identity and logo into letterhead HTML", () => {
    const template = getTemplateDefinition("schooling-certificate.v1");
    expect(template).not.toBeNull();
    const html = template!.compileHtml("fr", {
      ...LETTER_PAYLOAD,
      logoUrl: "data:image/png;base64,AAAA",
      schoolAddress: "Boulevard Latrille, Cocody, Abidjan",
      schoolPhone: "+225 27 22 44 00 00",
      schoolEmail: "secretariat@edaya-ci.test",
    });
    expect(html).toContain("data:image/png;base64,AAAA");
    expect(html).toContain("Boulevard Latrille, Cocody, Abidjan");
    expect(html).toContain("+225 27 22 44 00 00");
    expect(html).toContain("secretariat@edaya-ci.test");
    expect(html).toContain("@page");
    expect(html).toContain(".letter-header");
  });

  test("renders a receipt through the stub PDF path", async () => {
    const result = await renderDocument({
      templateKey: "receipt.v1",
      locale: "fr",
      payload: LETTER_PAYLOAD,
    }, { pdfRenderer: createRecordingPdfRenderer(new TextEncoder().encode("%PDF-receipt")) });
    expect(result.kind).toBe("success");
  });
});
