export function isPgliteLockError(error: unknown): boolean {
  const text = error instanceof Error
    ? `${error.name} ${error.message} ${error.stack ?? ''}`
    : String(error)
  return /mutex|Aborted\(\)/i.test(text)
}

export function pgliteLockHelpMessage(): string {
  return (
    'Could not open local PGlite (edaya_backend/.data/school) — the database file is locked.\n'
    + '  1. Stop the API: Ctrl+C in every terminal running `bun dev` / `bun repo dev`.\n'
    + '  2. On Windows, end any leftover `bun.exe` still holding `.data` (Task Manager).\n'
    + '  3. Rerun: bun repo db migrate school local\n'
    + 'Or wipe and let startup migrate: stop API → delete `.data` → `bun dev` '
    + '(RUN_MIGRATIONS_ON_STARTUP=true in apps/api/config.local.jsonc).'
  )
}
