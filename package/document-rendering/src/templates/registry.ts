import type { RenderFormat, TemplateCatalogEntry } from '@edaya/document-contracts'
import type { TemplateAssets } from './load-assets.ts'
import Ajv from 'ajv'
import { compileTemplateHtml } from './compile-html.ts'
import { LOGBOOK_V1_ASSETS } from './logbook.v1/assets.ts'
import { REPORT_CARD_V1_ASSETS } from './report-card.v1/assets.ts'

export interface TemplateDefinition {
  readonly key: string
  readonly formats: readonly RenderFormat[]
  readonly locales: readonly string[]
  readonly version: string
  readonly assets: TemplateAssets
  validatePayload: (payload: unknown) => string | null
  compileHtml: (locale: string, payload: unknown) => string
}

function createTemplateDefinition(assets: TemplateAssets): TemplateDefinition {
  const ajv = new Ajv({ allErrors: true, strict: false })
  const validate = ajv.compile(assets.schema)

  return {
    key: assets.manifest.key,
    formats: assets.manifest.formats,
    locales: assets.manifest.locales,
    version: assets.manifest.version,
    assets,
    validatePayload(payload: unknown): string | null {
      if (validate(payload))
        return null
      const first = validate.errors?.[0]
      if (!first)
        return 'payload is invalid'
      const path = first.instancePath.length > 0 ? first.instancePath.replaceAll('/', '.').slice(1) : 'payload'
      if (first.keyword === 'required') {
        const params = first.params as { missingProperty?: unknown }
        const missing = params.missingProperty
        if (typeof missing === 'string') {
          return path === 'payload'
            ? `payload.${missing} is required`
            : `${path}.${missing} is required`
        }
      }
      return `${path} ${first.message ?? 'is invalid'}`
    },
    compileHtml(locale: string, payload: unknown): string {
      return compileTemplateHtml({ locale, payload, assets })
    },
  }
}

const REPORT_CARD_V1 = createTemplateDefinition(REPORT_CARD_V1_ASSETS)
const LOGBOOK_V1 = createTemplateDefinition(LOGBOOK_V1_ASSETS)

const TEMPLATES: readonly TemplateDefinition[] = [REPORT_CARD_V1, LOGBOOK_V1]

export function listTemplateDefinitions(): readonly TemplateDefinition[] {
  return TEMPLATES
}

export function getTemplateDefinition(key: string): TemplateDefinition | null {
  return TEMPLATES.find(template => template.key === key) ?? null
}

export function toCatalogEntry(template: TemplateDefinition): TemplateCatalogEntry {
  return {
    key: template.key,
    formats: template.formats,
    locales: template.locales,
    version: template.version,
  }
}
