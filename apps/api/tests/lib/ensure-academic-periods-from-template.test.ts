import { describe, expect, it } from "bun:test";
import {
  collectTemplateReportCardPeriods,
} from "@/lib/onboarding/ensure-academic-periods-from-template";
import { IVORY_COAST_STRUCTURE_TEMPLATES } from "@edaya/fixtures/onboarding";

describe("ensureAcademicPeriodsFromTemplates helpers", () => {
  it("collects teaching periods and synthèse from Ivory Coast college template", () => {
    const college = IVORY_COAST_STRUCTURE_TEMPLATES.find(template => template.id === "ci-college");
    expect(college).toBeTruthy();

    const periods = collectTemplateReportCardPeriods([college!]);
    expect(periods.map(period => period.code)).toEqual(["T1", "T2", "T3", "SYNTHESE"]);
    expect(periods.find(period => period.code === "SYNTHESE")?.name).toBe("Synthèse trimestrielle");
  });
});
