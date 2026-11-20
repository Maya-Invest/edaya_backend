import { describe, expect, test } from "bun:test";
import { getTemplateDefinition, renderDocument } from "../src/index";
import { EXAMPLE_ANNUAL_RENDER_REQUEST } from "./annual-example";

describe("annual report-card presentation", () => {
  test("validates the dedicated academic fixture and keeps the ordinary presentation", () => {
    const annual = getTemplateDefinition("annual-report-card.v1")!;
    const ordinary = getTemplateDefinition("report-card.v1")!;
    expect(annual.validatePayload(EXAMPLE_ANNUAL_RENDER_REQUEST.payload)).toBeNull();
    const html = annual.compileHtml("fr", EXAMPLE_ANNUAL_RENDER_REQUEST.payload);
    for (const block of ["doc-header", "student-block", "row-bilan", "row-totals", "summary-row", "council-block", "doc-footer"])
      expect(html).toContain(block);
    expect(html).toContain("Bulletin annuel");
    expect(html).toContain("Poids des périodes");
    expect(html).toContain("table-header-group");
    expect(annual.assets.styles).toContain("font-size: 8pt");
    expect(ordinary.assets.styles).toContain("font-size: 8pt");
    expect(html).not.toContain("XOF");
  });

  test("uses the captured scale for every annual and period heading", () => {
    for (const locale of ["en", "fr"] as const) {
      const html = getTemplateDefinition("annual-report-card.v1")!.compileHtml(locale, {
        ...EXAMPLE_ANNUAL_RENDER_REQUEST.payload,
        gradingMaximum: "4",
        aggregateLabel: "GPA",
        semesterAverage: "3.125 / 4",
      });
      expect(html).not.toContain("/ 20");
      expect(html).toContain("GPA");
      expect(html.match(/class="scale">\/ 4/g)).toHaveLength(4);
    }
  });

  test("forces landscape consistently even when the caller requests portrait", async () => {
    const inputs: Array<{ orientation: string }> = [];
    const result = await renderDocument({ ...EXAMPLE_ANNUAL_RENDER_REQUEST, options: { orientation: "portrait" } }, {
      pdfRenderer: { async render(input) {
        inputs.push(input);
        return new TextEncoder().encode("%PDF-test");
      } },
    });
    expect(result.kind).toBe("success");
    expect(inputs[0]?.orientation).toBe("landscape");
  });

  test("compiles English semester reports with missing grades and long names", () => {
    const html = getTemplateDefinition("annual-report-card.v1")!.compileHtml("en", {
      ...EXAMPLE_ANNUAL_RENDER_REQUEST.payload,
      documentTitle: "Annual report card",
      periods: [{ id: "s1", label: "Semester 1", weight: "1", average: "0.00" }, { id: "s2", label: "Semester 2", weight: "3", average: "12.00" }],
      subjects: Array.from({ length: 45 }, (_, index) => ({ name: `Subject ${index} — Science, technology and sustainable development`, kind: "subject", average: "9.00", periodAverages: ["0.00", "—"], coefficient: "3", total: "27.00" })),
    });
    expect(html).toContain("Annual avg");
    expect(html).toContain("Semester 1 × 1");
    expect(html).toContain("Semester 2 × 3");
    expect(html).toContain("Subject 44");
    expect(html).toContain("—");
  });
});
