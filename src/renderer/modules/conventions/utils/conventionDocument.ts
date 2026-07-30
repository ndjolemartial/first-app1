import { mergeTemplate } from './conventionTemplate';
import { pxToMm, buildHeaderTemplate, buildFooterTemplate, buildEndOfDocumentHtml } from '../../../shared/utils/documentZones';

/**
 * Filtre les modèles par défaut correspondant exactement au type et à la
 * nature (avenant ou souscription) de la convention — même logique que
 * `ConventionDocumentPage`, partagée avec tout appelant ayant besoin du
 * document généré (ex. pièce jointe PDF sur « Envoyer un message »). Renvoie
 * la liste complète (généralement un seul élément) ; à l'appelant de choisir
 * (ex. premier élément par défaut, ou sélection utilisateur).
 */
export function filterDefaultConventionTemplates(templates: any[], convention: any): any[] {
  return templates.filter((t) => {
    if (t.type !== convention.type) return false;
    if (!t.isDefault) return false;
    if (convention.type === 'AVENANT' && convention.amendmentType) {
      if (t.amendmentType !== convention.amendmentType) return false;
    }
    if (convention.type === 'SOUSCRIPTION' && convention.souscriptionType) {
      if (t.souscriptionType !== convention.souscriptionType) return false;
    }
    return true;
  });
}

export interface ConventionDocumentHtml {
  bodyHtml:       string;
  headerTemplate: string;
  footerTemplate: string;
  headerMm:       number;
  footerMm:       number;
}

/** Fusionne un modèle de convention avec les données de la convention (variables `{{...}}`). */
export function buildConventionDocumentHtml(
  convention: any,
  template: any | null,
  countriesMap: Record<string, string>,
): ConventionDocumentHtml {
  const mergedHeader = mergeTemplate(template?.header, convention, countriesMap);
  const mergedBody = mergeTemplate(template?.body, convention, countriesMap);
  const mergedFooter = mergeTemplate(template?.footer, convention, countriesMap);
  const mergedEndOfDocument = mergeTemplate(template?.endOfDocument, convention, countriesMap);

  const headerWidth = template?.headerWidth ?? 100;
  const headerHeight = template?.headerHeight ?? 140;
  const footerWidth = template?.footerWidth ?? 100;
  const footerHeight = template?.footerHeight ?? 140;
  const footerBgColor: string | null = template?.footerBgColor ?? null;
  const endOfDocumentWidth = template?.endOfDocumentWidth ?? 100;
  const endOfDocumentHeight = template?.endOfDocumentHeight ?? 140;
  const endOfDocumentBgColor: string | null = template?.endOfDocumentBgColor ?? null;

  const headerMm = pxToMm(headerHeight);
  const footerMm = pxToMm(footerHeight);
  const endOfDocBlock = buildEndOfDocumentHtml(
    mergedEndOfDocument, endOfDocumentWidth, endOfDocumentHeight, endOfDocumentBgColor,
  );
  const bodyHtml = `<div class="doc-body">${mergedBody}${endOfDocBlock}</div>`;
  const headerTemplate = buildHeaderTemplate(mergedHeader, headerWidth, headerMm);
  const footerTemplate = buildFooterTemplate(mergedFooter, footerWidth, footerMm, footerBgColor);

  return { bodyHtml, headerTemplate, footerTemplate, headerMm, footerMm };
}

/** Nom de fichier exporté : référence + nom du client (particulier ou entreprise), assaini. */
export function conventionExportFileName(convention: any): string {
  const sanitize = (s: string) => s.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const clientLabel = convention.client?.type === 'INDIVIDUEL'
    ? `${convention.client?.lastName ?? ''} ${convention.client?.firstName ?? ''}`
    : (convention.client?.entreprise ?? '');
  const sanitizedClient = sanitize(clientLabel);
  return sanitizedClient ? `${convention.reference}-${sanitizedClient}` : convention.reference;
}
