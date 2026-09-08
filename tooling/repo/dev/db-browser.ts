#!/usr/bin/env bun
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import process from 'node:process'

const target = process.argv[2]
if (target !== 'school' && target !== 'auth') {
  console.error('Usage: bun tooling/repo/dev/db-browser.ts <school|auth>')
  process.exit(1)
}

const repoRoot = resolve(import.meta.dirname, '../../..')
const envFile = resolve(repoRoot, 'apps/api/.env')

if (!existsSync(envFile)) {
  console.error('Missing apps/api/.env — run: cp apps/api/.env.example apps/api/.env')
  process.exit(1)
}

const PAGE_SIZE = 50
const defaultPort = target === 'auth' ? 8191 : 8192

function resolveRepoLocalPath(pathValue: string): string {
  if (pathValue.startsWith('/')) {
    return pathValue
  }
  if (pathValue === '.data' || pathValue.startsWith('.data/')) {
    return resolve(repoRoot, pathValue)
  }
  return resolve(process.cwd(), pathValue)
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light dark; font-family: ui-sans-serif, system-ui, sans-serif; }
    body { margin: 24px; line-height: 1.4; }
    h1 { margin: 0 0 8px; font-size: 1.25rem; }
    .meta { color: #666; margin-bottom: 20px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f4f4f4; position: sticky; top: 0; }
    ul { padding-left: 1.2rem; columns: 2; }
    a { color: #2563eb; }
    .pager { margin-top: 16px; display: flex; gap: 12px; align-items: center; }
    code { font-size: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  ${body}
</body>
</html>`
}

interface DbBrowserBackend {
  label: string
  listTables: () => Promise<string[]>
  getRows: (table: string, offset: number, limit: number) => Promise<{ total: number, rows: Record<string, unknown>[] }>
  close: () => Promise<void>
}

async function createAuthBackend(dataDir: string): Promise<DbBrowserBackend> {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite(dataDir)

  return {
    label: `${dataDir} (auth schema)`,
    async listTables() {
      const result = await db.query<{ table_name: string }>(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'auth'
        ORDER BY 1
      `)
      return result.rows.map(row => String(row.table_name))
    },
    async getRows(table, offset, limit) {
      const quoted = `auth."${table.replaceAll('"', '""')}"`
      const countResult = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${quoted}`)
      const total = Number(countResult.rows[0]?.c ?? 0)
      const rowsResult = await db.query(`SELECT * FROM ${quoted} LIMIT $1 OFFSET $2`, [limit, offset])
      return { total, rows: rowsResult.rows as Record<string, unknown>[] }
    },
    async close() {
      await db.close()
    },
  }
}

async function createSchoolBackend(dataDir: string): Promise<DbBrowserBackend> {
  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite(dataDir)

  return {
    label: dataDir,
    async listTables() {
      const result = await db.query<{ tablename: string }>(`
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY 1
      `)
      return result.rows.map(row => String(row.tablename))
    },
    async getRows(table, offset, limit) {
      const quoted = `"${table.replaceAll('"', '""')}"`
      const countResult = await db.query<{ c: number }>(`SELECT count(*)::int AS c FROM ${quoted}`)
      const total = Number(countResult.rows[0]?.c ?? 0)
      const rowsResult = await db.query(`SELECT * FROM ${quoted} LIMIT $1 OFFSET $2`, [limit, offset])
      return { total, rows: rowsResult.rows as Record<string, unknown>[] }
    },
    async close() {
      await db.close()
    },
  }
}

async function createBackend(): Promise<DbBrowserBackend> {
  if (target === 'auth') {
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl?.startsWith('pglite:')) {
      console.error('Auth browser only supports local PGlite. Set DATABASE_URL=pglite:.data/school in apps/api/.env.')
      process.exit(1)
    }

    const dataDir = databaseUrl.slice('pglite:'.length).trim()
    if (!dataDir || dataDir === 'pglite') {
      console.error('Auth browser needs a persisted PGlite path, e.g. DATABASE_URL=pglite:.data/school')
      process.exit(1)
    }

    const resolvedDir = resolveRepoLocalPath(dataDir)
    if (!existsSync(resolvedDir)) {
      console.error(`School/auth database not found: ${resolvedDir}`)
      console.error('Start the API and run `bun repo seed` first.')
      process.exit(1)
    }

    return createAuthBackend(resolvedDir)
  }

  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl?.startsWith('pglite:')) {
    console.error('School browser only supports local PGlite. Set DATABASE_URL=pglite:.data/school in apps/api/.env.')
    process.exit(1)
  }

  const dataDir = databaseUrl.slice('pglite:'.length).trim()
  if (!dataDir || dataDir === 'pglite') {
    console.error('School browser needs a persisted PGlite path, e.g. DATABASE_URL=pglite:.data/school')
    process.exit(1)
  }

  const resolvedDir = resolveRepoLocalPath(dataDir)
  if (!existsSync(resolvedDir)) {
    console.error(`School database not found: ${resolvedDir}`)
    console.error('Start the API and run `bun repo seed` first.')
    process.exit(1)
  }

  console.log('Note: stop `bun repo dev` first — PGlite allows only one handle on .data/school.\n')
  return createSchoolBackend(resolvedDir)
}

function renderIndex(tables: string[], backendLabel: string): string {
  const items = tables.map(table => `<li><a href="/table/${encodeURIComponent(table)}">${escapeHtml(table)}</a></li>`).join('')
  return layout(
    `${target} database`,
    `<p class="meta"><code>${escapeHtml(backendLabel)}</code></p>
     <ul>${items}</ul>`,
  )
}

function renderTable(table: string, total: number, rows: Record<string, unknown>[], page: number): string {
  const columns = rows.length > 0
    ? Object.keys(rows[0]!)
    : []

  const header = columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')
  const body = rows.map((row) => {
    const cells = columns.map(column => `<td><code>${escapeHtml(row[column])}</code></td>`).join('')
    return `<tr>${cells}</tr>`
  }).join('')

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const prev = page > 1 ? `<a href="/table/${encodeURIComponent(table)}?page=${page - 1}">Previous</a>` : ''
  const next = page < pageCount ? `<a href="/table/${encodeURIComponent(table)}?page=${page + 1}">Next</a>` : ''

  return layout(
    table,
    `<p class="meta"><a href="/">Tables</a> · ${total} row(s) · page ${page} / ${pageCount}</p>
     <table>
       <thead><tr>${header}</tr></thead>
       <tbody>${body || `<tr><td colspan="${Math.max(columns.length, 1)}">No rows</td></tr>`}</tbody>
     </table>
     <div class="pager">${prev} ${next}</div>`,
  )
}

const backend = await createBackend()
const tables = await backend.listTables()
const tableSet = new Set(tables)
const port = Number(process.env.DB_BROWSER_PORT ?? defaultPort)
const url = `http://127.0.0.1:${port}`

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    const { pathname, searchParams } = new URL(request.url)

    if (pathname === '/') {
      return new Response(renderIndex(tables, backend.label), {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    const tableMatch = pathname.match(/^\/table\/([^/]+)$/)
    if (!tableMatch) {
      return new Response('Not found', { status: 404 })
    }

    const table = decodeURIComponent(tableMatch[1]!)
    if (!tableSet.has(table)) {
      return new Response('Unknown table', { status: 404 })
    }

    const page = Math.max(1, Number(searchParams.get('page') ?? '1') || 1)
    const offset = (page - 1) * PAGE_SIZE
    const { total, rows } = await backend.getRows(table, offset, PAGE_SIZE)

    return new Response(renderTable(table, total, rows, page), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  },
})

console.log(`Local DB browser running at ${url}`)
console.log('Press Ctrl+C to stop.\n')

if (process.platform === 'darwin') {
  Bun.spawn(['open', url])
}

async function shutdown() {
  server.stop()
  await backend.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
