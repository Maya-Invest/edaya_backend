import { Buffer } from "node:buffer";
import { describe, expect, test } from "bun:test";
import { createDocumentRenderer } from "../src/document-renderer";
import { DocumentRenderError } from "../src/errors";
import { createStubPdfRenderer } from "../src/adapters/stub-pdf-renderer";
import { renderDocument } from "../src/services/render-document";
import { getTemplateDefinition, listTemplateDefinitions } from "../src/templates/registry";
import { DOCUMENT_RENDERING_FAILURES } from "../src/types";
import { EXAMPLE_LOGBOOK_RENDER_REQUEST, EXAMPLE_RENDER_REQUEST } from "./examples";
import { createRecordingPdfRenderer } from "./recording-renderer";

const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("renderDocument", () => {
  test("renders inline PDF bytes and calls the PdfRenderer each time", async () => {
    const pdfRenderer = createRecordingPdfRenderer(new TextEncoder().encode("%PDF-stub"));
    const first = await renderDocument(EXAMPLE_RENDER_REQUEST, { pdfRenderer });
    const second = await renderDocument(EXAMPLE_RENDER_REQUEST, { pdfRenderer });

    expect(first.kind).toBe("success");
    expect(second.kind).toBe("success");
    if (first.kind === "success" && second.kind === "success") {
      expect(first.value.sha256).toBe(second.value.sha256);
      expect(first.value.renderId).not.toBe(second.value.renderId);
      expect(first.value.contentType).toBe("application/pdf");
      expect(first.value.bytes.subarray(0, 8)).toEqual(new TextEncoder().encode("%PDF-stu"));
    }
    expect(pdfRenderer.calls).toHaveLength(2);
    expect(pdfRenderer.calls[0]?.html).toContain("YAO Curie Marie Christelle Ahou");
    expect(pdfRenderer.calls[0]?.html).toContain("Français");
    expect(pdfRenderer.calls[0]?.html).toContain("10,75 / 20");
  });

  test("rejects a root principalStampUrl that letter and report-card schemas do not allow", () => {
    const extra = { principalStampUrl: "data:image/png;base64,xx" };
    const letter = getTemplateDefinition("enrollment-record.v1");
    expect(letter).not.toBeNull();
    expect(letter!.validatePayload({
      studentName: "Yao Christelle",
      schoolName: "LYCEE MAMIE ADJOUA",
      schoolYear: "2025-2026",
      ...extra,
    })).toMatch(/additional/i);

    const incident = getTemplateDefinition("incident-report.v1");
    expect(incident).not.toBeNull();
    expect(incident!.validatePayload({
      schoolName: "LYCEE MAMIE ADJOUA",
      paragraphs: [{ text: "Bagare" }],
      ...extra,
    })).toMatch(/additional/i);

    const bulletin = getTemplateDefinition("report-card.v1");
    expect(bulletin).not.toBeNull();
    expect(bulletin!.validatePayload({
      ...(EXAMPLE_RENDER_REQUEST.payload as Record<string, unknown>),
      ...extra,
    })).toMatch(/additional/i);
    expect(bulletin!.validatePayload({
      ...(EXAMPLE_RENDER_REQUEST.payload as Record<string, unknown>),
      council: {
        ...(EXAMPLE_RENDER_REQUEST.payload as { council?: Record<string, unknown> }).council,
        principalStampUrl: "data:image/png;base64,xx",
      },
    })).toBeNull();
  });

  test("rejects invalid payload", async () => {
    const pdfRenderer = createRecordingPdfRenderer(new Uint8Array());
    const result = await renderDocument({
      templateKey: "report-card.v1",
      locale: "fr",
      payload: {},
    }, { pdfRenderer });
    expect(result.kind).toBe("failure");
    if (result.kind === "failure") {
      expect(result.code).toBe(DOCUMENT_RENDERING_FAILURES.invalidPayload);
      expect(result.message).toContain("studentName");
    }
  });

  test("rejects unknown templates", async () => {
    const pdfRenderer = createRecordingPdfRenderer(new Uint8Array());
    const result = await renderDocument({
      templateKey: "missing.v1",
      locale: "fr",
      payload: {},
    }, { pdfRenderer });
    expect(result).toEqual({
      kind: "failure",
      code: DOCUMENT_RENDERING_FAILURES.templateNotFound,
      message: "Unknown template: missing.v1",
    });
  });

  test("compiles report-card.v1 HTML from template assets", () => {
    const template = getTemplateDefinition("report-card.v1");
    expect(template).not.toBeNull();
    const html = template!.compileHtml("fr", EXAMPLE_RENDER_REQUEST.payload);
    expect(html).toContain("LYCEE MAMIE ADJOUA");
    expect(html).toContain("BULLETIN TRIMESTRIEL DE NOTES");
    expect(html).toContain("Mathématiques");
    expect(html).toContain("BILAN LETTRES");
    expect(html).toContain("--brand: #1f4b7a");
  });

  test("compiles logbook.v1 HTML from template assets", () => {
    const template = getTemplateDefinition("logbook.v1");
    expect(template).not.toBeNull();
    const html = template!.compileHtml("fr", EXAMPLE_LOGBOOK_RENDER_REQUEST.payload);
    expect(html).toContain("Collège Edaya Cocody");
    expect(html).toContain("6ème A");
    expect(html).toContain("Mathématiques");
    expect(html).toContain("Nombres entiers");
    expect(html).toContain("Français");
    expect(html).toContain("--brand: #1f4b7a");
  });

  test("compiles every group B-E template from a closed payload", () => {
    const payload = {
      studentName: "Yao Christelle",
      schoolName: "LYCEE MAMIE ADJOUA",
      schoolYear: "2025-2026",
      classLabel: "6ème A",
      documentTitle: "Document officiel",
      paragraphs: [{ text: "Document officiel." }],
      fields: [{ label: "Classe", value: "6ème A" }],
      columns: ["Libellé", "Montant"],
      rows: [{ cells: ["Scolarité", "60 000 XOF"] }],
    };
    const skipped = new Set(["report-card.v1", "logbook.v1"]);
    for (const template of listTemplateDefinitions()) {
      if (skipped.has(template.key)) {
        continue;
      }
      expect(template.validatePayload(payload)).toBeNull();
      const html = template.compileHtml("fr", payload);
      expect(html).toContain("Yao Christelle");
      expect(html).toContain("LYCEE MAMIE ADJOUA");
    }
  });

  test("overlays signature images onto PDF", async () => {
    const result = await renderDocument({
      ...EXAMPLE_RENDER_REQUEST,
      options: {
        signatures: [{
          slot: "principal",
          imageBytes: new Uint8Array(TINY_PNG),
          position: { page: "last", x: 400, y: 80, width: 120 },
        }],
      },
    }, {
      pdfRenderer: createStubPdfRenderer(),
    });

    expect(result.kind).toBe("success");
    if (result.kind === "success") {
      expect(result.value.contentType).toBe("application/pdf");
      expect(result.value.bytes.length).toBeGreaterThan(100);
      expect(Buffer.from(result.value.bytes.subarray(0, 5)).toString()).toBe("%PDF-");
    }
  });
});

describe("createDocumentRenderer", () => {
  test("returns bytes from the core port", async () => {
    const renderer = createDocumentRenderer({
      pdfRenderer: createRecordingPdfRenderer(new TextEncoder().encode("%PDF-port")),
    });
    const result = await renderer.render({
      templateKey: "report-card.v1",
      locale: "fr",
      payload: EXAMPLE_RENDER_REQUEST.payload,
    });
    expect(result.contentType).toBe("application/pdf");
    expect(result.renderId.startsWith("rnd_")).toBe(true);
    expect(Buffer.from(result.bytes).toString()).toContain("%PDF-port");
  });

  test("throws DocumentRenderError on invalid payload", async () => {
    const renderer = createDocumentRenderer({
      pdfRenderer: createRecordingPdfRenderer(new Uint8Array()),
    });
    try {
      await renderer.render({
        templateKey: "report-card.v1",
        locale: "fr",
        payload: {},
      });
      throw new Error("expected DocumentRenderError");
    }
    catch (error) {
      expect(error).toBeInstanceOf(DocumentRenderError);
      expect((error as DocumentRenderError).code).toBe(DOCUMENT_RENDERING_FAILURES.invalidPayload);
    }
  });
});
