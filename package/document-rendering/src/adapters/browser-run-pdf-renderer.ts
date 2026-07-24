import type { PdfRenderer, PdfRenderInput } from '../ports/pdf-renderer.ts'

/** Minimal Browser Run binding surface used by the PDF adapter. */
export interface BrowserRunBinding {
  quickAction: (
    action: 'pdf',
    options: {
      html: string
      pdfOptions?: {
        format?: string
        landscape?: boolean
        printBackground?: boolean
        margin?: {
          top?: string
          bottom?: string
          left?: string
          right?: string
        }
      }
    },
  ) => Promise<Response>
}

/** Cloudflare Browser Run HTML→PDF via Workers binding. */
export function createBrowserRunPdfRenderer(browser: BrowserRunBinding): PdfRenderer {
  return {
    async render(input: PdfRenderInput): Promise<Uint8Array> {
      const response = await browser.quickAction('pdf', {
        html: input.html,
        pdfOptions: {
          format: input.paper === 'Letter' ? 'letter' : 'a4',
          landscape: input.orientation === 'landscape',
          printBackground: true,
          margin: {
            top: '0',
            bottom: '0',
            left: '0',
            right: '0',
          },
        },
      })

      if (!response.ok)
        throw new Error(`Browser Run PDF failed: ${response.status}`)

      return new Uint8Array(await response.arrayBuffer())
    },
  }
}
