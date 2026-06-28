#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import process from 'node:process'
import {
  extractClientBindingsFromOpenApi,
  formatClientBindingsTypeScript,
} from './client-bindings-openapi'

const repoRoot = resolve(import.meta.dirname, '..')

function resolveOpenApiPath(): string {
  const openApiIndex = process.argv.indexOf('--openapi')
  if (openApiIndex === -1) {
    return resolve(repoRoot, 'apps/webapp/src/lib/api/openapi.json')
  }

  const requestedPath = process.argv[openApiIndex + 1]
  if (!requestedPath) {
    throw new Error('--openapi requires a file path')
  }
  return resolve(process.cwd(), requestedPath)
}

function resolveOutputPath(): string {
  const outputIndex = process.argv.indexOf('--output')
  if (outputIndex === -1) {
    return resolve(
      repoRoot,
      'package/generated-api-client/src/generated/client-bindings.ts',
    )
  }

  const requestedPath = process.argv[outputIndex + 1]
  if (!requestedPath) {
    throw new Error('--output requires a file path')
  }
  return resolve(process.cwd(), requestedPath)
}

const openApiPath = resolveOpenApiPath()
const outputPath = resolveOutputPath()
const openApi = JSON.parse(readFileSync(openApiPath, 'utf8')) as {
  info?: Record<string, unknown>
}
const clientBindings = extractClientBindingsFromOpenApi(openApi)
const source = formatClientBindingsTypeScript(clientBindings)

mkdirSync(dirname(outputPath), { recursive: true })
writeFileSync(outputPath, source)

console.log(`API client bindings generated at ${outputPath}`)
