import { resolve } from 'node:path'

export const repoRoot = resolve(import.meta.dir, '../../..')
export const trackedOpenApiPath = resolve(repoRoot, 'tooling/docs/openapi/fixtures/openapi.json')
export const docsClientRoot = resolve(repoRoot, 'package/docs-client')
export const docsClientSrc = resolve(docsClientRoot, 'src')
export const docsClientOpenApiPath = resolve(docsClientSrc, 'openapi.json')
export const docsClientSchemaPath = resolve(docsClientSrc, 'schema.d.ts')
