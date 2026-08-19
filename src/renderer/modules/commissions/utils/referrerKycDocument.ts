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
 * Fiche KYC de l'Apporteur d'affaire — même standard/même mise en page que
 * la Fiche KYC Client (`clients/utils/kycDocument.ts`), avec une section
 * « Identification » adaptée aux champs propres à `BusinessReferrer` (pas de
 * pièce d'identité ni de nationalité sur ce modèle, contrairement à Client/
 * Owner — un apporteur d'affaire externe n'est pas soumis au même niveau
 * d'identification à la création). « Personne morale » déterminé par la
 * présence d'une société (`companyName`), faute de champ `type` dédié.
 */

export { formatSourceOfFunds, formatRelationshipPurpose } from '../../../shared/utils/kycDocumentKit';

export function buildReferrerKycDocumentHtml(
  referrer: any,
  company: CompanyInfo | null,
  logo: { mimeType: string; base64: string } | null,
  countriesMap: Record<string, string> = {},
): string {
  const isCompanyLike = Boolean(referrer.companyName);
  const personName = [referrer.lastName, referrer.firstName].filter(Boolean).join(' ') || '—';
  const countryName = referrer.country ? (countriesMap[referrer.country] ?? referrer.country) : null;

  const identitySection = section('1. Identification', ''
    + rowPair('Nom et prénoms', personName, 'Société (le cas échéant)', referrer.companyName)
    + rowPair('Téléphone', referrer.phone ?? referrer.mobile, 'Email', referrer.email)
    + rowPair('Adresse', [referrer.address, referrer.city].filter(Boolean).join(', '), 'Pays', countryName)
    + rowPair('IBAN', referrer.bankIban, 'BIC', referrer.bankBic));

  const beneficialOwnersSection = isCompanyLike ? beneficialOwnersTable(2, Array.isArray(referrer.beneficialOwners) ? referrer.beneficialOwners : []) : '';

  const professionalSection = section('3. Situation professionnelle et revenus', ''
    + rowPair('Employeur / activité', referrer.employerName, 'Revenu mensuel déclaré', referrer.monthlyIncome != null ? formatCurrency(Number(referrer.monthlyIncome)) : null));

  const fundsSection = section('4. Origine des fonds et du patrimoine', ''
    + row('Origine des fonds', formatSourceOfFunds(referrer.sourceOfFunds, referrer.sourceOfFundsOther))
    + row('Origine du patrimoine', referrer.sourceOfWealth));

  const relationshipSection = section('5. Objet et nature de la relation d\'affaires', ''
    + row('Objet de la relation d\'affaires', formatRelationshipPurpose(referrer.relationshipPurpose, referrer.relationshipPurposeOther))
    + rowPair('Volume mensuel estimé des opérations', referrer.expectedTransactionVolume != null ? formatCurrency(Number(referrer.expectedTransactionVolume)) : null,
        'Canal d\'entrée en relation', referrer.acquisitionChannel));

  const pepSection = section('6. Statut PPE (Personne Politiquement Exposée)', ''
    + rowPair('Personne politiquement exposée', referrer.isPep ? 'Oui' : 'Non', 'Catégorie', referrer.isPep ? (PEP_CATEGORY_LABEL[referrer.pepCategory] ?? referrer.pepCategory) : null)
    + rowPair('Fonction exercée', referrer.pepFunction, 'Lien avec un pays à risque', referrer.hasRiskyCountryLink ? 'Oui' : 'Non'));

  const signatureSection = buildSignatureSection(
    referrer.kycSignedPlace, referrer.kycSignedAt ? formatDate(referrer.kycSignedAt) : null,
    'de l\'apporteur d\'affaire',
  );

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      ${buildKycHeader("FICHE D'IDENTIFICATION ET DE<br/>CONNAISSANCE DE L'APPORTEUR D'AFFAIRE (KYC)", company, logo, referrer.id ? `APP-${referrer.id}` : '……………………')}
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

/** Fiche KYC Apporteur d'affaire vierge (non renseignée), imprimable depuis « Apporteurs d'affaire ». */
export function buildBlankReferrerKycDocumentHtml(
  company: CompanyInfo | null,
  logo: { mimeType: string; base64: string } | null,
): string {
  const identitySection = `
    ${blockTitle('1. Identification')}
    ${blankLine('Nom et prénoms')}
    ${blankLine('Société (le cas échéant)')}
    ${blankPair('Téléphone', 'Email')}
    ${blankLine('Adresse')}
    ${blankPair('IBAN', 'BIC')}`;

  const beneficialOwnersSection = `
    ${blockTitle('2. Bénéficiaires effectifs (société)')}
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
      ${buildKycHeader("FICHE D'IDENTIFICATION ET DE<br/>CONNAISSANCE DE L'APPORTEUR D'AFFAIRE (KYC)", company, logo, '……………………')}
      ${identitySection}
      ${beneficialOwnersSection}
      ${professionalSection}
      ${fundsSection}
      ${relationshipSection}
      ${pepSection}
      ${DECLARATION_SECTION}
      ${buildSignatureSection(null, null, 'de l\'apporteur d\'affaire')}
    </div>`;
}

export const buildReferrerKycFooterTemplate = buildKycFooterTemplate;
