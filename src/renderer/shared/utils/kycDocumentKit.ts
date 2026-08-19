import { formatDate } from './format';

/**
 * Briques communes aux documents « Fiche KYC » (Clients, Propriétaires,
 * Apporteurs d'affaire) — standard UEMOA/BCEAO, mise en page fixe (même
 * principe que les documents d'estimation du Module 17). Chaque module porte
 * son propre `buildXxxKycDocumentHtml` pour la section « Identification »
 * (champs différents selon l'entité) mais réutilise ces briques pour tout le
 * reste : listes fermées, cases à cocher, pied de page, déclaration, signature.
 */

export const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export interface CompanyInfo {
  name?: string | null;
  denomination?: string | null;
  registreCommerce?: string | null;
  compteContribuable?: string | null;
  phoneFixed?: string | null;
  phoneMobile1?: string | null;
  phoneMobile2?: string | null;
  website?: string | null;
  email?: string | null;
  address?: string | null;
}

/** Origine des fonds — liste fermée proposée en sélection multiple sur la Fiche KYC. */
export const SOURCE_OF_FUNDS_OPTIONS = [
  { value: 'FONDS_PROPRES_ENTREPRISE', label: "Fonds propres de l'entreprise" },
  { value: 'SALAIRE_REVENUS_PROFESSIONNELS', label: 'Salaire / revenus professionnels' },
  { value: 'REVENUS_LOCATIFS', label: 'Revenus locatifs' },
  { value: 'VENTE_ACTIF', label: "Vente d'un actif" },
  { value: 'EPARGNE', label: 'Épargne' },
  { value: 'HERITAGE_SUCCESSION', label: 'Héritage / succession' },
  { value: 'DONATION', label: 'Donation' },
  { value: 'EMPRUNT_BANCAIRE', label: 'Emprunt bancaire' },
  { value: 'FINANCEMENT_TIERS', label: "Financement d'un tiers" },
  { value: 'DIVIDENDES', label: 'Dividendes' },
  { value: 'REVENUS_COMMERCIAUX', label: 'Revenus commerciaux' },
  { value: 'AUTRE', label: 'Autre (à préciser)' },
];
export const SOURCE_OF_FUNDS_LABEL: Record<string, string> = Object.fromEntries(SOURCE_OF_FUNDS_OPTIONS.map((o) => [o.value, o.label]));

/** Formate la sélection « Origine des fonds » (codes + précision libre pour AUTRE) en texte affichable. */
export function formatSourceOfFunds(codes: unknown, other: unknown): string {
  const list = Array.isArray(codes) ? codes as string[] : [];
  const labels = list.map((c) => (c === 'AUTRE' && other ? `Autre : ${other}` : SOURCE_OF_FUNDS_LABEL[c] ?? c));
  return labels.join(', ');
}

/** Objet de la relation d'affaires — liste fermée proposée en sélection multiple sur la Fiche KYC. */
export const RELATIONSHIP_PURPOSE_OPTIONS = [
  { value: 'ACHAT_TERRAIN', label: 'Achat de terrain(s)' },
  { value: 'SOUSCRIPTION_LOTISSEMENT', label: 'Souscription à un projet de lotissement' },
  { value: 'ACHAT_BIEN', label: 'Achat de maison / appartement / immeuble' },
  { value: 'SOUSCRIPTION_PROGRAMME', label: 'Souscription à un programme immobilier' },
  { value: 'VENTE_BIEN', label: "Vente d'un bien immobilier" },
  { value: 'CONSTRUCTION', label: 'Construction' },
  { value: 'PROMOTION_IMMOBILIERE', label: 'Promotion immobilière' },
  { value: 'LOTISSEMENT_AMENAGEMENT', label: 'Lotissement / aménagement foncier' },
  { value: 'GESTION_LOCATIVE', label: 'Gestion locative' },
  { value: 'LOCATION', label: 'Location' },
  { value: 'AUTRE', label: 'Autre (à préciser)' },
];
export const RELATIONSHIP_PURPOSE_LABEL: Record<string, string> = Object.fromEntries(RELATIONSHIP_PURPOSE_OPTIONS.map((o) => [o.value, o.label]));

/** Formate la sélection « Objet de la relation d'affaires » (codes + précision libre pour AUTRE) en texte affichable. */
export function formatRelationshipPurpose(codes: unknown, other: unknown): string {
  const list = Array.isArray(codes) ? codes as string[] : [];
  const labels = list.map((c) => (c === 'AUTRE' && other ? `Autre : ${other}` : RELATIONSHIP_PURPOSE_LABEL[c] ?? c));
  return labels.join(', ');
}

/* ─── Blocs « fiche renseignée » (tableau étiquette/valeur) ─────────── */

export function section(title: string, rowsHtml: string): string {
  return `
    <div style="margin-top:16px;">
      <div style="background:#e2e8f0;padding:6px 10px;font-weight:bold;font-size:11pt;border-left:4px solid #7f1d1d;">${esc(title)}</div>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:10pt;">${rowsHtml}</table>
    </div>`;
}

export function rowPair(label1: string, value1: unknown, label2: string, value2: unknown): string {
  const fmt = (v: unknown) => (v == null || v === '' ? '—' : String(v));
  return `<tr>
    <td style="padding:4px 8px;color:#475569;width:22%;border-bottom:1px solid #f1f5f9;">${esc(label1)}</td>
    <td style="padding:4px 8px;font-weight:600;color:#0f172a;width:28%;border-bottom:1px solid #f1f5f9;">${esc(fmt(value1))}</td>
    <td style="padding:4px 8px;color:#475569;width:22%;border-bottom:1px solid #f1f5f9;">${esc(label2)}</td>
    <td style="padding:4px 8px;font-weight:600;color:#0f172a;width:28%;border-bottom:1px solid #f1f5f9;">${esc(fmt(value2))}</td>
  </tr>`;
}

export function row(label: string, value: unknown): string {
  const v = value == null || value === '' ? '—' : String(value);
  return `<tr>
    <td style="padding:4px 8px;color:#475569;width:38%;border-bottom:1px solid #f1f5f9;">${esc(label)}</td>
    <td style="padding:4px 8px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(v)}</td>
  </tr>`;
}

/** Tableau des bénéficiaires effectifs déjà renseignés. */
export function beneficialOwnersTable(sectionNumber: number, owners: any[]): string {
  if (!owners.length) return '';
  return `
    <div style="margin-top:16px;">
      <div style="background:#e2e8f0;padding:6px 10px;font-weight:bold;font-size:11pt;border-left:4px solid #7f1d1d;">${sectionNumber}. Bénéficiaires effectifs</div>
      <table style="width:100%;border-collapse:collapse;margin-top:6px;font-size:9.5pt;">
        <tr>
          <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd5e1;color:#475569;">Nom et prénoms</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd5e1;color:#475569;">Nationalité</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd5e1;color:#475569;">Pièce d'identité</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd5e1;color:#475569;">% détention</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd5e1;color:#475569;">Rôle</th>
          <th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd5e1;color:#475569;">PPE</th>
        </tr>
        ${owners.map((bo) => `
        <tr>
          <td style="padding:4px 8px;font-weight:600;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc([bo.lastName, bo.firstName].filter(Boolean).join(' '))}</td>
          <td style="padding:4px 8px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(bo.nationality ?? '—')}</td>
          <td style="padding:4px 8px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(bo.idNumber ?? '—')}</td>
          <td style="padding:4px 8px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${bo.ownershipPct != null ? esc(`${bo.ownershipPct}%`) : '—'}</td>
          <td style="padding:4px 8px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${esc(bo.role ?? '—')}</td>
          <td style="padding:4px 8px;color:#0f172a;border-bottom:1px solid #f1f5f9;">${bo.isPep ? 'Oui' : 'Non'}</td>
        </tr>`).join('')}
      </table>
    </div>`;
}

/* ─── Blocs « fiche vierge » (à compléter à la main) ─────────────────── */

/** Titre de bloc seul (sans le tableau de `section()`). */
export function blockTitle(title: string): string {
  return `<div style="margin-top:16px;background:#e2e8f0;padding:6px 10px;font-weight:bold;font-size:11pt;border-left:4px solid #7f1d1d;">${esc(title)}</div>`;
}

/** Ligne « Étiquette : ______________ » à compléter à la main, sur toute la largeur. */
export function blankLine(label: string): string {
  return `<div style="display:flex;align-items:flex-end;gap:6px;margin-top:10px;font-size:10pt;">
    <span style="color:#475569;white-space:nowrap;">${esc(label)} :</span>
    <span style="flex:1;border-bottom:1px solid #94a3b8;height:14px;"></span>
  </div>`;
}

/** Deux lignes « Étiquette : ______ » côte à côte, à compléter à la main. */
export function blankPair(label1: string, label2: string): string {
  return `<div style="display:flex;gap:20px;margin-top:10px;">
    <div style="flex:1;display:flex;align-items:flex-end;gap:6px;font-size:10pt;">
      <span style="color:#475569;white-space:nowrap;">${esc(label1)} :</span>
      <span style="flex:1;border-bottom:1px solid #94a3b8;height:14px;"></span>
    </div>
    <div style="flex:1;display:flex;align-items:flex-end;gap:6px;font-size:10pt;">
      <span style="color:#475569;white-space:nowrap;">${esc(label2)} :</span>
      <span style="flex:1;border-bottom:1px solid #94a3b8;height:14px;"></span>
    </div>
  </div>`;
}

/** Case à cocher vierge suivie d'un libellé. */
export function checkbox(label: string): string {
  return `<span style="display:inline-flex;align-items:center;gap:5px;margin:3px 18px 3px 0;white-space:nowrap;font-size:9.5pt;">
    <span style="display:inline-block;width:10px;height:10px;border:1px solid #475569;flex-shrink:0;"></span>${esc(label)}
  </span>`;
}

/** Grille de cases à cocher vierges (une liste fermée d'options à cocher à la main). */
export function checkboxGroup(labels: string[]): string {
  return `<div style="margin-top:8px;line-height:2;">${labels.map(checkbox).join('')}</div>`;
}

/** Tableau vierge (lignes vides à remplir) — ex. bénéficiaires effectifs de la fiche non renseignée. */
export function blankTable(headers: string[], emptyRows: number): string {
  const head = `<tr>${headers.map((h) => `<th style="text-align:left;padding:4px 8px;border-bottom:2px solid #cbd5e1;color:#475569;font-size:9pt;">${esc(h)}</th>`).join('')}</tr>`;
  const body = Array.from({ length: emptyRows }).map(() =>
    `<tr>${headers.map(() => `<td style="padding:10px 8px;border-bottom:1px solid #f1f5f9;">&nbsp;</td>`).join('')}</tr>`
  ).join('');
  return `<table style="width:100%;border-collapse:collapse;margin-top:6px;">${head}${body}</table>`;
}

/* ─── Blocs communs de fin de document ───────────────────────────────── */

export const DECLARATION_SECTION = `
    <div style="margin-top:24px;font-size:10pt;line-height:1.6;">
      Je soussigné(e), .................................................................................................................................................................. …….,
      certifie que les informations et documents communiqués dans le cadre de la présente fiche sont, à ma connaissance, exacts et sincères.
    </div>`;

/** Bloc signature — `signedPlace`/`signedDate` déjà formatés (ou `null` pour une fiche vierge). */
export function buildSignatureSection(signedPlace: string | null, signedDate: string | null, signerLabel: string): string {
  return `
    <div style="margin-top:32px;display:flex;justify-content:space-between;font-size:10pt;">
      <div>Fait à ${esc(signedPlace || '……………………')}, le ${signedDate || '……………………'}</div>
    </div>
    <div style="margin-top:40px;display:flex;justify-content:space-between;font-size:10pt;">
      <div style="width:45%;text-align:center;">
        <div style="border-top:1px solid #94a3b8;padding-top:6px;">Signature ${esc(signerLabel)}</div>
      </div>
      <div style="width:45%;text-align:center;">
        <div style="border-top:1px solid #94a3b8;padding-top:6px;">Signature de l'agent</div>
      </div>
    </div>`;
}

export function buildKycHeader(title: string, company: CompanyInfo | null, logo: { mimeType: string; base64: string } | null, reference: string, dateLabel = "Date d'édition"): string {
  const logoHtml = logo ? `<img src="data:${logo.mimeType};base64,${logo.base64}" style="max-height:60px;max-width:180px;object-fit:contain;" />` : '';
  return `
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>${logoHtml}<div style="font-weight:bold;margin-top:4px;">${esc(company?.name || '')}</div></div>
        <div style="text-align:right;">
          <h1 style="font-size:15pt;color:#1E3A5F;margin:0;">${title}</h1>
          <div style="font-size:9.5pt;color:#475569;margin-top:4px;">Référence : ${esc(reference)}</div>
          <div style="font-size:9.5pt;color:#475569;">${esc(dateLabel)} : ${formatDate(new Date())}</div>
        </div>
      </div>`;
}

/**
 * Pied de page imprimé sur chaque page d'une Fiche KYC — coordonnées légales
 * de l'entreprise (dénomination sociale suivie du nom/sigle entre
 * parenthèses, RCCM, compte contribuable, contacts, site web, email,
 * pagination), sur deux lignes centrées, séparées du contenu de page par une
 * barre rouge. Consommé via `documentExport.printDocument` (mécanisme natif
 * d'en-tête/pied de page Chromium — HTML/CSS inline uniquement).
 */
export function buildKycFooterTemplate(company: CompanyInfo | null): string {
  const nameLabel = company?.denomination && company?.name
    ? `${company.denomination} (${company.name})`
    : (company?.denomination || company?.name || '');

  const line1Parts = [
    nameLabel || null,
    company?.registreCommerce ? `RCCM : ${company.registreCommerce}` : null,
    company?.compteContribuable ? `Compte contribuable : ${company.compteContribuable}` : null,
  ].filter((v): v is string => Boolean(v));

  const contacts = [company?.phoneFixed, company?.phoneMobile1, company?.phoneMobile2].filter(Boolean).join(' / ');
  const line2Parts = [
    contacts || null,
    company?.website || null,
    company?.email || null,
  ].filter((v): v is string => Boolean(v));

  const line1Html = line1Parts.length ? esc(line1Parts.join('  —  ')) : '';
  const line2Html = line2Parts.length ? esc(line2Parts.join('  —  ')) : '';

  return `
    <div style="position:relative;width:100%;box-sizing:border-box;padding:4px 18mm 0 18mm;margin-bottom:5mm;border-top:2px solid #7f1d1d;font-size:7.5pt;color:#475569;font-family:'Segoe UI',Arial,sans-serif;text-align:center;">
      <div style="position:absolute;top:4px;right:18mm;white-space:nowrap;">Page <span class="pageNumber"></span> / <span class="totalPages"></span></div>
      ${line1Html ? `<div style="font-weight:bold;color:#0f172a;">${line1Html}</div>` : ''}
      ${line2Html ? `<div>${line2Html}</div>` : ''}
    </div>`;
}
