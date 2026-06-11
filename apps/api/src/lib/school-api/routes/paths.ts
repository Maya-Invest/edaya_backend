/** Root mount path for generated school API routes (commands, queries, entities, system). */
export const SCHOOL_API_BASE_PATH = "/core";

export function schoolApiPath(...segments: string[]): string {
  return `${SCHOOL_API_BASE_PATH}/${segments.join("/")}`;
}
