import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/entries/node.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  tsconfig: 'tsconfig.json',
  noExternal: [/^@edaya\//],
  external: ['bun:sqlite'],
})
