import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import {
  section, rowPair, row, beneficialOwnersTable, blockTitle, blankLine, blankPair,
  checkboxGroup, blankTable, DECLARATION_SECTION, buildSignatureSection, buildKycHeader,
  buildKycFooterTemplate, CompanyInfo,
  SOURCE_OF_FUNDS_OPTIONS, RELATIONSHIP_PURPOSE_OPTIONS,
  formatSourceOfFunds, formatRelationshipPurpose,
} from '../../../shared/utils/kycDocumentKit';

/**
 * Fiche KYC du Propriétaire — même standard/même mise en page que la Fiche
 * KYC Client (`clients/utils/kycDocument.ts`), avec une section
 * « Identification » adaptée aux champs propres à `Owner` (pas de filiation
 * ni de profession/date de naissance sur ce modèle).
 */

export { formatSourceOfFunds, formatRelationshipPurpose } from '../../../shared/utils/kycDocumentKit';

export function buildOwnerKycDocumentHtml(
  owner: any,
  company: CompanyInfo | null,
  logo: { mimeType: string; base64: string } | null,
  countriesMap: Record<string, string> = {},
): string {
  const isCompanyLike = owner.type !== 'INDIVIDUEL';
  const name = isCompanyLike ? (owner.companyName ?? '—') : [owner.lastName, owner.firstName].filter(Boolean).join(' ') || '—';
  const countryName = owner.country ? (countriesMap[owner.country] ?? owner.country) : null;

  const identitySection = section('1. Identification', ''
    + rowPair('Type de propriétaire', isCompanyLike ? 'Entreprise' : 'Particulier', isCompanyLike ? 'Raison sociale' : 'Nom et prénoms', name)
    + (isCompanyLike
      ? rowPair('Registre de commerce', owner.registreCommerce, 'Compte contribuable', owner.compte_contribuable)
      : rowPair('Nationalité', owner.nationality, 'Pièce d\'identité N°', owner.idNumber))
    + (isCompanyLike
      ? rowPair('Représentant légal', [owner.legalRepFirstName, owner.legalRepLastName].filter(Boolean).join(' '), 'Contact représentant', owner.legalRepPhone)
      : rowPair('Type de pièce', owner.idType?.label, '', null))
    + rowPair('Téléphone', owner.phone ?? owner.mobile, 'Email', owner.email)
    + rowPair('Adresse', [owner.address, owner.city].filter(Boolean).join(', '), 'Pays', countryName)
    + rowPair('IBAN', owner.bankIban, 'BIC', owner.bankBic));

  const beneficialOwnersSection = isCompanyLike ? beneficialOwnersTable(2, Array.isArray(owner.beneficialOwners) ? owner.beneficialOwners : []) : '';

  const professionalSection = section('3. Situation professionnelle et revenus', ''
    + rowPair('Employeur / activité', owner.employerName, 'Revenu mensuel déclaré', owner.monthlyIncome != null ? formatCurrency(Number(owner.monthlyIncome)) : null));

  const fundsSection = section('4. Origine des fonds et du patrimoine', ''
    + row('Origine des fonds', formatSourceOfFunds(owner.sourceOfFunds, owner.sourceOfFundsOther))
    + row('Origine du patrimoine', owner.sourceOfWealth));

  const relationshipSection = section('5. Objet et nature de la relation d\'affaires', ''
    + row('Objet de la relation d\'affaires', formatRelationshipPurpose(owner.relationshipPurpose, owner.relationshipPurposeOther))
    + rowPair('Volume mensuel estimé des opérations', owner.expectedTransactionVolume != null ? formatCurrency(Number(owner.expectedTransactionVolume)) : null,
        'Canal d\'entrée en relation', owner.acquisitionChannel));

  const pepSection = section('6. Statut PPE (Personne Politiquement Exposée)', ''
    + rowPair('Personne politiquement exposée', owner.isPep ? 'Oui' : 'Non', 'Catégorie', owner.isPep ? (PEP_CATEGORY_LABEL[owner.pepCategory] ?? owner.pepCategory) : null)
    + rowPair('Fonction exercée', owner.pepFunction, 'Lien avec un pays à risque', owner.hasRiskyCountryLink ? 'Oui' : 'Non'));

  const signatureSection = buildSignatureSection(
    owner.kycSignedPlace, owner.kycSignedAt ? formatDate(owner.kycSignedAt) : null,
    isCompanyLike ? 'du représentant' : 'du propriétaire',
  );

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      ${buildKycHeader("FICHE D'IDENTIFICATION ET DE<br/>CONNAISSANCE DU PROPRIÉTAIRE (KYC)", company, logo, owner.id ? `PROP-${owner.id}` : '……………………')}
      ${identitySection}
      ${beneficialOwnersSection}
      ${professionalSection}
      ${fundsSection}
      ${relationshipSection}
      ${pepSection}
      ${DECLARATION_SECTION}
      ${signatureSection}
    </div>`;
}

/** Fiche KYC Propriétaire vierge (non renseignée), imprimable depuis « Gestion des propriétaires ». */
export function buildBlankOwnerKycDocumentHtml(
  company: CompanyInfo | null,
  logo: { mimeType: string; base64: string } | null,
): string {
  const identitySection = `
    ${blockTitle('1. Identification')}
    ${checkboxGroup(['Particulier', 'Entreprise'])}
    ${blankLine("Nom et prénoms (particulier) / Raison sociale (entreprise)")}
    ${blankPair('Nationalité', "Pièce d'identité N°")}
    ${blankPair('Registre de commerce (RCCM)', 'Compte contribuable')}
    ${blankLine('Représentant légal (entreprise)')}
    ${blankPair('Téléphone', 'Email')}
    ${blankLine('Adresse')}
    ${blankPair('IBAN', 'BIC')}`;

  const beneficialOwnersSection = `
    ${blockTitle('2. Bénéficiaires effectifs (entreprise)')}
    ${blankTable(['Nom et prénoms', 'Nationalité', "Pièce d'identité", '% détention', 'Rôle', 'PPE'], 3)}`;

  const professionalSection = `
    ${blockTitle('3. Situation professionnelle et revenus')}
    ${blankPair('Employeur / activité', 'Revenu mensuel déclaré (FCFA)')}`;

  const fundsSection = `
    ${blockTitle('4. Origine des fonds et du patrimoine')}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Origine des fonds (cocher une ou plusieurs cases) :</div>
    ${checkboxGroup(SOURCE_OF_FUNDS_OPTIONS.map((o) => o.label))}
    ${blankLine('Si « Autre », précisez')}
    ${blankLine('Origine du patrimoine')}`;

  const relationshipSection = `
    ${blockTitle("5. Objet et nature de la relation d'affaires")}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Objet de la relation d'affaires (cocher une ou plusieurs cases) :</div>
    ${checkboxGroup(RELATIONSHIP_PURPOSE_OPTIONS.map((o) => o.label))}
    ${blankLine('Si « Autre », précisez')}
    ${blankPair('Volume mensuel estimé des opérations (FCFA)', "Canal d'entrée en relation")}`;

  const pepSection = `
    ${blockTitle('6. Statut PPE (Personne Politiquement Exposée)')}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Personne politiquement exposée :</div>
    ${checkboxGroup(['Oui', 'Non'])}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Si oui, catégorie :</div>
    ${checkboxGroup(Object.values(PEP_CATEGORY_LABEL))}
    ${blankLine('Fonction exercée')}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Lien avec un pays à risque :</div>
    ${checkboxGroup(['Oui', 'Non'])}`;

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      ${buildKycHeader("FICHE D'IDENTIFICATION ET DE<br/>CONNAISSANCE DU PROPRIÉTAIRE (KYC)", company, logo, '……………………')}
      ${identitySection}
      ${beneficialOwnersSection}
      ${professionalSection}
      ${fundsSection}
      ${relationshipSection}
      ${pepSection}
      ${DECLARATION_SECTION}
      ${buildSignatureSection(null, null, 'du propriétaire / du représentant')}
    </div>`;
}

export const buildOwnerKycFooterTemplate = buildKycFooterTemplate;
