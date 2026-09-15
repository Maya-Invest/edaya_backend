import type { DocumentIssuance, DocumentRenderInput, DocumentSignatureSlot } from '@edaya/core'
import type { BaseSchoolService } from '../../services/base-school-service'
import { BusinessRuleViolationError, DOCUMENT_FAILURES, DOCUMENT_ISSUANCE_MAX_BYTES } from '@edaya/core'
import { loadPublishedStudentPortrait } from '../files/load-published-student-portrait'
import { bytesToDataUri } from './bytes-to-data-uri'
import { loadSchoolIssuanceAssets } from './load-school-issuance-assets'

export interface HydratedDocumentRender {
  input: DocumentRenderInput
}

function asFacts(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {}
  const { kind: _kind, ...rest } = value as Record<string, unknown>
  return Object.fromEntries(Object.entries(rest).filter(([, entry]) => entry !== undefined))
}

function assetDataUri(asset: { body: Uint8Array, contentType?: string }, fallback = 'image/png'): string {
  return bytesToDataUri(asset.body, asset.contentType ?? fallback)
}

export async function hydrateDocumentPayload(base: BaseSchoolService, issuance: DocumentIssuance, options: { preview?: boolean } = {}): Promise<HydratedDocumentRender> {
  const facts = asFacts(issuance.snapshot.facts)
  const assets = await loadSchoolIssuanceAssets(base, issuance.schoolId)
  const logoUrl = assets.logo ? assetDataUri(assets.logo) : undefined
  const crestUrl = assets.crest ? assetDataUri(assets.crest) : undefined
  const stampUrl = assets.stamp ? assetDataUri(assets.stamp) : undefined
  const signatureUrl = assets.signature ? assetDataUri(assets.signature) : undefined
  let photoUrl: string | undefined
  if (issuance.snapshot.portraitAttachmentId && issuance.studentId) {
    const portrait = await loadPublishedStudentPortrait(base, issuance.studentId)
    if (portrait)
      photoUrl = assetDataUri(portrait, 'image/jpeg')
    else if (issuance.templateKey === 'student-id-card.v1')
      throw new BusinessRuleViolationError(DOCUMENT_FAILURES.ASSET_MISSING, 'An approved portrait is required for a student ID card')
  }
  else if (issuance.templateKey === 'student-id-card.v1') {
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.ASSET_MISSING, 'An approved portrait is required for a student ID card')
  }

  const payload = {
    ...facts,
    ...(logoUrl ? { logoUrl } : {}),
    ...(crestUrl ? { crestUrl } : {}),
    ...(stampUrl ? { stampUrl, principalStampUrl: stampUrl } : {}),
    ...(signatureUrl ? { signatureUrl } : {}),
    ...(photoUrl ? { photoUrl } : {}),
    ...(issuance.number ? { orderNumber: issuance.number } : {}),
    ...(options.preview || issuance.status === 'preview' ? { watermark: true } : {}),
  }

  const signatures: DocumentSignatureSlot[] = []
  if (assets.stamp) {
    signatures.push({
      slot: 'stamp',
      imageBytes: assets.stamp.body,
      position: { page: 'last', x: 72, y: 72, width: 96 },
    })
  }
  if (assets.signature) {
    signatures.push({
      slot: 'signature',
      imageBytes: assets.signature.body,
      position: { page: 'last', x: 280, y: 72, width: 120 },
    })
  }

  const encoded = new TextEncoder().encode(JSON.stringify(payload))
  if (encoded.byteLength > DOCUMENT_ISSUANCE_MAX_BYTES)
    throw new BusinessRuleViolationError(DOCUMENT_FAILURES.ASSET_MISSING, 'Document payload exceeds the render budget')

  return {
    input: {
      templateKey: issuance.templateKey,
      locale: issuance.locale,
      payload,
      options: {
        paper: issuance.templateKey === 'student-id-card.v1' ? 'A4' : 'A4',
        orientation: issuance.templateKey === 'class-timetable.v1' || issuance.templateKey === 'teacher-timetable.v1' ? 'landscape' : 'portrait',
        signatures: issuance.templateKey === 'report-card.v1' || issuance.templateKey === 'logbook.v1' ? signatures : undefined,
      },
    },
  }
}
