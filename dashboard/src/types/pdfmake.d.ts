/**
 * O pdfmake 0.3 não publica tipos. Em vez de puxar @types/pdfmake (escrito para
 * a API 0.2), declaramos aqui só o que o projeto usa — o suficiente para o
 * TypeScript checar as chamadas sem inventar um contrato que não existe.
 */
declare module 'pdfmake/build/pdfmake' {
  interface DocumentoPdf {
    download(nomeArquivo?: string): void;
    open(): void;
    getBlob(callback: (blob: Blob) => void): void;
  }

  interface PdfMake {
    createPdf(definicao: unknown, opcoes?: unknown): DocumentoPdf;
    addFontContainer(container: unknown): void;
    addVirtualFileSystem(vfs: unknown): void;
    addFonts(fontes: unknown): void;
  }

  const pdfMake: PdfMake;
  export default pdfMake;
}

declare module 'pdfmake/build/standard-fonts/Helvetica' {
  const container: { vfs: Record<string, unknown>; fonts: Record<string, unknown> };
  export default container;
}
