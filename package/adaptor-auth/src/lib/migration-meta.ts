/** PostgreSQL schema that holds Drizzle migration journals. */
export const MIGRATIONS_SCHEMA = 'drizzle'

/** Auth migration journal (separate from school — no shared `when` ordering). */
export const AUTH_MIGRATIONS_TABLE = '__drizzle_migrations_auth'
