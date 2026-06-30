#!/usr/bin/env bun
import { exportOpenApi } from './export.ts'
import { generateClientArtifactsFromOpenApi } from './generate-bindings.ts'

await exportOpenApi()
await generateClientArtifactsFromOpenApi()

console.log('Generated API artifacts updated.')
