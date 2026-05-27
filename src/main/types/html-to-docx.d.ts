declare module 'html-to-docx' {
  /**
   * Convertit du HTML en un Buffer .docx.
   *
   * @param htmlString    HTML du corps du document.
   * @param headerHtml    HTML rendu dans l'en-tête de chaque page (ou `null`).
   * @param options       Options de mise en page (marges en twips, page numbers…).
   * @param footerHtml    HTML rendu dans le pied de page de chaque page (ou `null`).
   */
  function HTMLtoDOCX(
    htmlString: string,
    headerHtml?: string | null,
    options?: Record<string, unknown>,
    footerHtml?: string | null,
  ): Promise<Buffer>;
  export default HTMLtoDOCX;
}
