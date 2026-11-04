import type { AcademicPeriod, AcademicYear } from "@edaya/core";

const day = 86400000;
const isoDay = (date: Date) => date.toISOString().slice(0, 10);

export function quickCodeExpiries(now: number, zone: string, years: AcademicYear[], periods: AcademicPeriod[]) {
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" });
  const localDay = (at: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(at).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const today = localDay(now);
  const contains = (range: { startDate: Date; endDate: Date }) => isoDay(range.startDate) <= today && today <= isoDay(range.endDate);
  const current = years.filter(year => year.status === "published" && contains(year));
  const year = current.length === 1 ? current[0] : undefined;
  const matching = periods.filter(period => period.academicYearId === year?.id && period.isPublished && contains(period));
  // Find the first instant after the inclusive final school date, including DST transitions.
  function exclusiveEnd(end: Date) {
    const finalDay = isoDay(end);
    let low = Date.parse(finalDay) - day;
    let high = low + 4 * day;
    while (high - low > 1) {
      const middle = Math.floor((high + low) / 2);
      if (localDay(middle) <= finalDay)
        low = middle;
      else high = middle;
    }
    return high;
  }
  return { week: now + 7 * day, month: now + 30 * day, none: null, ...(year ? { year: exclusiveEnd(year.endDate) } : {}), ...(matching.length === 1 ? { period: exclusiveEnd(matching[0]!.endDate) } : {}) };
}
