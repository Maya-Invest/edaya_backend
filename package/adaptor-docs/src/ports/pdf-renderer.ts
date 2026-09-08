export interface PdfRenderInput {
  readonly html: string;
  readonly paper: "A4" | "Letter";
  readonly orientation: "portrait" | "landscape";
}

export interface PdfRenderer {
  render: (input: PdfRenderInput) => Promise<Uint8Array>;
}
