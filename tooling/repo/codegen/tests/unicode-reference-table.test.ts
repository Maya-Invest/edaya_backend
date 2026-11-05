import { expect, test } from 'bun:test'

test('the Unicode reference table matches the pinned offline input', async () => {
	const process = Bun.spawn([Bun.which('bun')!, new URL('../unicode/generate.ts', import.meta.url).pathname], { stderr: 'pipe' })
	const error = await new Response(process.stderr).text()
	expect(error).toBe('')
	expect(await process.exited).toBe(0)
})
