/**
 * Dev seed IDs aligned with `apps/webapp/src/lib/data/school.ts` for future API wiring.
 * Extend this file as more domains are connected to the webapp.
 */

export const SEED_SCHOOL_ID = "sch-edaya-central";

export const SEED_ACADEMIC_YEAR_ID = "2025";

export const SEED_GRADE_LEVELS = [
  { id: "gl-6", name: "6ème", cycle: "Middle School", order: 1 },
  { id: "gl-5", name: "5ème", cycle: "Middle School", order: 2 },
  { id: "gl-4", name: "4ème", cycle: "Middle School", order: 3 },
  { id: "gl-3", name: "3ème", cycle: "Middle School", order: 4 },
  { id: "gl-2", name: "2nde", cycle: "High School", order: 5 },
  { id: "gl-1", name: "1ère", cycle: "High School", order: 6 },
  { id: "gl-t", name: "Terminale", cycle: "High School", order: 7 },
] as const;

export const SEED_CLASSES = [
  { id: "6a", gradeLevelId: "gl-6", name: "6th — A", capacity: 30 },
  { id: "6b", gradeLevelId: "gl-6", name: "6th — B", capacity: 30 },
  { id: "5a", gradeLevelId: "gl-5", name: "5th — A", capacity: 30 },
] as const;

export const SEED_STAFF = [
  { id: "st5", name: "Camille Moreau", email: "c.moreau@school.edu" },
  { id: "st3", name: "Mme Léon", email: "m.leon@school.edu" },
  { id: "st1", name: "Mme Dupont", email: "m.dupont@school.edu" },
  { id: "st7", name: "Tom Évrard", email: "t.evrard@school.edu" },
] as const;

export const SEED_STUDENTS = [
  { id: "s1", classId: "6a", name: "Amélie Laurent", birthDate: "2014-03-12" },
  { id: "s2", classId: "6a", name: "Noah Bennett", birthDate: "2014-07-22" },
  { id: "s3", classId: "6a", name: "Mira Okafor", birthDate: "2014-01-09" },
  { id: "s7", classId: "6b", name: "Liam Foster", birthDate: "2014-02-21" },
  { id: "s8", classId: "6b", name: "Zara Khan", birthDate: "2014-06-11" },
] as const;

export const SEED_GUARDIANS = [
  { id: "g1", name: "Claire Laurent", email: "c.laurent@mail.com", phone: "+33 6 12 34 56 78", studentIds: ["s1"] },
  { id: "g2", name: "James Bennett", email: "j.bennett@mail.com", phone: "+33 6 22 11 09 87", studentIds: ["s2"] },
] as const;

/** Shared dev password for seeded Better Auth accounts. Dev-only — never use in production. */
export const DEV_AUTH_PASSWORD = "DevPassword1!";

/** Staff accounts provisioned and linked during dev auth seed. */
export const DEV_AUTH_STAFF_ACCOUNTS = [
  { staffId: "st5", email: "c.moreau@school.edu", name: "Camille Moreau" },
  { staffId: "st1", email: "m.dupont@school.edu", name: "Mme Dupont" },
  { staffId: "st3", email: "m.leon@school.edu", name: "Mme Léon" },
  { staffId: "st7", email: "t.evrard@school.edu", name: "Tom Évrard" },
] as const;

/** Guardian accounts provisioned and linked during dev auth seed. */
export const DEV_AUTH_GUARDIAN_ACCOUNTS = [
  { guardianId: "g1", email: "c.laurent@mail.com", name: "Claire Laurent" },
] as const;

export const SEED_ACADEMIC_PERIODS = [
  { id: "2025-t1", name: "Trimestre 1", startDate: "2025-09-01", endDate: "2025-12-19" },
  { id: "2025-t2", name: "Trimestre 2", startDate: "2026-01-05", endDate: "2026-04-03" },
  { id: "2025-t3", name: "Trimestre 3", startDate: "2026-04-20", endDate: "2026-07-03" },
] as const;

export function splitDisplayName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? "Unknown", lastName: parts[0] ?? "Unknown" };
  }
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function parseSeedDate(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}
