import type { SignatureSlot } from '@edaya/document-contracts'
import { PDFDocument } from 'pdf-lib'

export interface OverlaySignaturesOptions {
  readonly fetchImpl?: typeof fetch
}

function resolvePageIndex(page: SignatureSlot['position']['page'], pageCount: number): number {
  if (page === 'first')
    return 0
  if (page === 'last')
    return Math.max(pageCount - 1, 0)
  if (typeof page === 'number' && Number.isInteger(page) && page >= 1 && page <= pageCount)
    return page - 1
  throw new Error(`Invalid signature page: ${String(page)}`)
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4E
    && bytes[3] === 0x47
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 3
    && bytes[0] === 0xFF
    && bytes[1] === 0xD8
    && bytes[2] === 0xFF
}

async function fetchImageBytes(
  imageUrl: string,
  fetchImpl: typeof fetch,
): Promise<Uint8Array> {
  const response = await fetchImpl(imageUrl)
  if (!response.ok)
    throw new Error(`Failed to fetch signature image: ${response.status}`)
  return new Uint8Array(await response.arrayBuffer())
}

export async function overlaySignatures(
  pdfBytes: Uint8Array,
  signatures: readonly SignatureSlot[],
  options: OverlaySignaturesOptions = {},
): Promise<Uint8Array> {
  if (signatures.length === 0)
    return pdfBytes

  const fetchImpl = options.fetchImpl ?? globalThis.fetch
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const pages = pdfDoc.getPages()
  if (pages.length === 0)
    throw new Error('Cannot overlay signatures on an empty PDF')

  for (const signature of signatures) {
    const imageBytes = await fetchImageBytes(signature.imageUrl, fetchImpl)
    const pageIndex = resolvePageIndex(signature.position.page, pages.length)
    const page = pages[pageIndex]!
    const image = isPng(imageBytes)
      ? await pdfDoc.embedPng(imageBytes)
      : isJpeg(imageBytes)
        ? await pdfDoc.embedJpg(imageBytes)
        : (() => {
            throw new Error(`Unsupported signature image type for slot ${signature.slot}`)
          })()

    const width = signature.position.width
    const height = width * (image.height / image.width)
    page.drawImage(image, {
      x: signature.position.x,
      y: signature.position.y,
      width,
      height,
    })
  }

  return pdfDoc.save()
}
