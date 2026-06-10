import env from "./env-runtime";

let localDb: any;
let localSqlClient: any = null;

if (env.DATABASE_URL === "memory" || env.DATABASE_URL === "pglite" || env.DATABASE_URL.startsWith("postgres://memory")) {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");

  const pglite = new PGlite();
  localDb = drizzle(pglite);
}
else {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const { default: postgres } = await import("postgres");

  localSqlClient = postgres(env.DATABASE_URL);
  localDb = drizzle(localSqlClient);
}

export const sqlClient = localSqlClient;
export const db = localDb;
