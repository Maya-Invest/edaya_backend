export function isEphemeralDatabase(databaseUrl: string): boolean {
  return databaseUrl === "memory"
    || databaseUrl === "pglite"
    || databaseUrl.startsWith("postgres://memory");
}
