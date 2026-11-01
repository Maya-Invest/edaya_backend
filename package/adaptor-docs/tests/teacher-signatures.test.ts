/* eslint-disable dot-notation -- Template fixtures use flexible payload records. */
import { describe, expect, test } from "bun:test";
import { getTemplateDefinition } from "../src/templates/registry";
import { EXAMPLE_ANNUAL_RENDER_REQUEST } from "./annual-example";
import { EXAMPLE_RENDER_REQUEST } from "./examples";

const teachers = [{ teacherId: "a", name: "Same Teacher Name", signatureUrl: "data:image/png;base64,signatureA" }, { teacherId: "b", name: "Same Teacher Name", signatureUrl: "data:image/png;base64,signatureB" }, { teacherId: "c", name: "Unsigned teacher" }];

describe("teacher signature template identities", () => {
  for (const locale of ["en", "fr"]) {
    for (const example of [EXAMPLE_RENDER_REQUEST, EXAMPLE_ANNUAL_RENDER_REQUEST]) {
      test(`${example.templateKey} pairs every teacher and preserves school signing (${locale})`, () => {
        const payload = structuredClone(example.payload) as { subjects: Array<Record<string, unknown>>; council: Record<string, unknown>; signatureUrl?: string };
        payload.subjects[0]!["teachers"] = teachers;
        payload.council["homeroomTeachers"] = [teachers[0]];
        payload.council["principalStampUrl"] = "data:image/png;base64,schoolSignature";
        payload.signatureUrl = "data:image/png;base64,schoolSignature";
        const definition = getTemplateDefinition(example.templateKey)!;
        expect(definition.validatePayload(payload)).toBeNull();
        const html = definition.compileHtml(locale, payload);
        expect(html.match(/signatureA/g)).toHaveLength(2);
        expect(html.match(/signatureB/g)).toHaveLength(1);
        expect(html).toContain("Unsigned teacher");
        expect(html).toContain("schoolSignature");
        expect(html).toContain("teacher-pair");
        expect(html).toContain("alt=\"Signature\"");
      });
    }
    test(`incident includes its author's signature and accepts an unsigned author (${locale})`, () => {
      const payload = { schoolName: "School", paragraphs: [{ text: "Incident" }], reporterTeachers: teachers.slice(0, 1), signatureUrl: "data:image/png;base64,schoolSignature" };
      const definition = getTemplateDefinition("incident-report.v1")!;
      expect(definition.validatePayload(payload)).toBeNull();
      expect(definition.compileHtml(locale, payload)).toContain("signatureA");
      expect(definition.compileHtml(locale, payload)).toContain(locale === "fr" ? "Signalé par" : "Reported by");
      expect(definition.validatePayload({ ...payload, reporterTeachers: [teachers[2]] })).toBeNull();
      expect(definition.validatePayload({ schoolName: "School", paragraphs: [{ text: "Staff incident" }] })).toBeNull();
    });
  }
});
