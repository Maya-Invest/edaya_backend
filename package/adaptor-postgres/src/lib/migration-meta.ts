/** PostgreSQL schema that holds Drizzle migration journals. */
export const MIGRATIONS_SCHEMA = 'drizzle'

/** School migration journal (separate from auth — no shared `when` ordering). */
export const SCHOOL_MIGRATIONS_TABLE = '__drizzle_migrations_school'

/** Pre-split journal table; kept for reference when inspecting legacy databases. */
export const LEGACY_MIGRATIONS_TABLE = '__drizzle_migrations'
