import { AcademicPeriod, AcademicYear, withShortName } from "@edaya/core";
import { expect, test } from "bun:test";
import { quickCodeExpiries } from "../quick-code-expiry";

test("all expiry choices use the inclusive local school day at the DST boundary", () => {
  const startDate = new Date("2026-01-01");
  const endDate = new Date("2026-11-01");
  const dates = { id: "year", schoolId: "school", name: "Current", startDate, endDate };
  const year = new AcademicYear(withShortName({ ...dates, status: "published" }));
  const period = new AcademicPeriod(withShortName({ ...dates, id: "fall", academicYearId: "year", isPublished: true }));
  const now = Date.parse("2026-11-02T04:59:59Z"); // Still Sunday in Toronto.
  const end = now + 1000;
  const choices = (at: number, periods = [period]) => quickCodeExpiries(at, "America/Toronto", [year], periods);
  expect(choices(now)).toEqual({ week: now + 604800000, month: now + 2592000000, period: end, year: end, none: null });
  expect(choices(end)).not.toHaveProperty("year");
  expect(choices(now, [period, period])).not.toHaveProperty("period");
});
