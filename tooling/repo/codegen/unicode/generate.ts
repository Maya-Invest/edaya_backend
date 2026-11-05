import { createHash } from 'node:crypto'

const data = await Bun.file(new URL('CaseFolding-15.1.0.txt', import.meta.url)).text()
if (createHash('sha256').update(data).digest('hex') !== '4e55acfdc32825a22e87670e9056a3bf94ad7c5400065778e9e10f8314372bcf')
  throw new Error('Unexpected Unicode 15.1.0 case folding data')

function literal(text: string) {
  return JSON.stringify(text).slice(1, -1).replace(/[^ -~]/g, unit => `\\u${unit.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}`)
}

const rows: string[] = []
for (const line of data.split('\n')) {
  const [source, status, mapping] = line.split('#')[0]!.split(';').map(value => value.trim())
  if (status !== 'C' && status !== 'F') continue
  const from = String.fromCodePoint(Number.parseInt(source!, 16))
  const to = mapping!.split(' ').map(hex => String.fromCodePoint(Number.parseInt(hex, 16))).join('')
  rows.push(`  '${literal(from)}': '${literal(to)}',`)
}

const output = `// Unicode 15.1.0 default full case folding, generated from CaseFolding-15.1.0.txt.
// Deliberately locale independent; no compatibility normalization or accent removal.
const mappings: Readonly<Record<string, string>> = {
${rows.join('\n')}
}

export function foldReferenceCase(value: string): string {
  return Array.from(value, character => mappings[character] ?? character).join('')
}
`
const target = new URL('../../../../package/domain-core/src/domain/shared/unicode-case-folding.ts', import.meta.url)
if (process.argv.includes('--write'))
  await Bun.write(target, output)
else if (await Bun.file(target).text() !== output)
  throw new Error('Regenerate the Unicode reference table with --write')
