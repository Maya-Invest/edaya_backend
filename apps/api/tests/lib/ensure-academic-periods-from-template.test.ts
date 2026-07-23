import { describe, expect, it } from "bun:test";
import {
  collectTemplateReportCardPeriods,
} from "@/lib/onboarding/ensure-academic-periods-from-template";
import { IVORY_COAST_STRUCTURE_TEMPLATES } from "@edaya/fixtures/onboarding";

describe("ensureAcademicPeriodsFromTemplates helpers", () => {
  it("collects teaching periods from Ivory Coast college template without synthèse", () => {
    const college = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === "ci-college");
    expect(college).toBeTruthy();
    expect(college?.reportCardStructure?.includeSummary).toBe(false);

    const periods = collectTemplateReportCardPeriods([college!]);
    expect(periods.map(period => period.code)).toEqual(["T1", "T2", "T3"]);
    expect(periods.some(period => period.code === "SYNTHESE")).toBe(false);
  });
});
