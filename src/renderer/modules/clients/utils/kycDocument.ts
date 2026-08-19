import { formatCurrency, formatDate } from '../../../shared/utils/format';
import { PEP_CATEGORY_LABEL } from '../../aml/utils/aml.utils';
import {
  esc, section, rowPair, row, beneficialOwnersTable, blockTitle, blankLine, blankPair,
  checkboxGroup, blankTable, DECLARATION_SECTION, buildSignatureSection, buildKycHeader,
  buildKycFooterTemplate, CompanyInfo,
  SOURCE_OF_FUNDS_OPTIONS, RELATIONSHIP_PURPOSE_OPTIONS,
  formatSourceOfFunds, formatRelationshipPurpose,
} from '../../../shared/utils/kycDocumentKit';

/**
 * Document imprimable « FICHE D'IDENTIFICATION ET DE CONNAISSANCE DU CLIENT
 * (KYC) » (standard UEMOA/BCEAO), généré directement depuis la fiche client —
 * la quasi-totalité de l'identité (nom, filiation, profession, adresse,
 * pièce d'identité…) est déjà portée par `Client`, complétée par le bloc
 * « Informations complémentaires » du formulaire. Sections communes
 * (déclaration, signature, pied de page, listes fermées) portées par
 * `shared/utils/kycDocumentKit.ts`, réutilisé aussi par les fiches KYC
 * Propriétaires et Apporteurs d'affaire.
 */

export { SOURCE_OF_FUNDS_OPTIONS, SOURCE_OF_FUNDS_LABEL, formatSourceOfFunds, RELATIONSHIP_PURPOSE_OPTIONS, RELATIONSHIP_PURPOSE_LABEL, formatRelationshipPurpose } from '../../../shared/utils/kycDocumentKit';

const CLIENT_TYPE_LABEL: Record<string, string> = {
  INDIVIDUEL: 'Personne physique',
  ENTREPRISE: 'Personne morale',
  ASSOCIATION_ONG: 'Association / ONG',
};

export function buildClientKycDocumentHtml(
  client: any,
  company: CompanyInfo | null,
  logo: { mimeType: string; base64: string } | null,
  countriesMap: Record<string, string> = {},
): string {
  const isCompanyLike = client.type !== 'INDIVIDUEL';
  const name = isCompanyLike ? (client.entreprise ?? '—') : [client.lastName, client.firstName].filter(Boolean).join(' ') || '—';
  const countryName = client.country ? (countriesMap[client.country] ?? client.country) : null;

  const identitySection = section('1. Identification', ''
    + rowPair('Type de client', CLIENT_TYPE_LABEL[client.type] ?? client.type, isCompanyLike ? 'Raison sociale' : 'Nom et prénoms', name)
    + (isCompanyLike
      ? rowPair('Registre de commerce', client.registre_de_commerce, 'Compte contribuable', client.compte_contribuable)
      : rowPair('Nationalité', client.nationality, 'Pièce d\'identité N°', client.idNumber))
    + (isCompanyLike
      ? rowPair('Représentant légal', [client.legalRepFirstName, client.legalRepLastName].filter(Boolean).join(' '), 'Contact représentant', client.legalRepPhone)
      : rowPair('Type de pièce', client.idType?.label, 'Date de naissance', client.birthDate ? formatDate(client.birthDate) : null))
    + rowPair('Téléphone', client.phone ?? client.mobile, 'Email', client.email)
    + rowPair('Adresse', [client.address, client.commune, client.city].filter(Boolean).join(', '), 'Pays', countryName));

  const filiationSection = !isCompanyLike && (client.fatherFirstName || client.fatherLastName || client.motherFirstName || client.motherLastName)
    ? section('2. Filiation', ''
      + rowPair('Père', [client.fatherFirstName, client.fatherLastName].filter(Boolean).join(' '), 'Mère', [client.motherFirstName, client.motherLastName].filter(Boolean).join(' ')))
    : '';

  const beneficialOwnersSection = isCompanyLike ? beneficialOwnersTable(2, Array.isArray(client.beneficialOwners) ? client.beneficialOwners : []) : '';

  const professionalSection = section('3. Situation professionnelle et revenus', ''
    + rowPair('Profession', client.profession, 'Employeur / activité', client.employerName)
    + rowPair('Revenu mensuel déclaré', client.monthlyIncome != null ? formatCurrency(Number(client.monthlyIncome)) : null, '', ''));

  const fundsSection = section('4. Origine des fonds et du patrimoine', ''
    + row('Origine des fonds', formatSourceOfFunds(client.sourceOfFunds, client.sourceOfFundsOther))
    + row('Origine du patrimoine', client.sourceOfWealth));

  const relationshipSection = section('5. Objet et nature de la relation d\'affaires', ''
    + row('Objet de la relation d\'affaires', formatRelationshipPurpose(client.relationshipPurpose, client.relationshipPurposeOther))
    + rowPair('Volume mensuel estimé des opérations', client.expectedTransactionVolume != null ? formatCurrency(Number(client.expectedTransactionVolume)) : null,
        'Canal d\'entrée en relation', client.acquisitionChannel));

  const pepSection = section('6. Statut PPE (Personne Politiquement Exposée)', ''
    + rowPair('Personne politiquement exposée', client.isPep ? 'Oui' : 'Non', 'Catégorie', client.isPep ? (PEP_CATEGORY_LABEL[client.pepCategory] ?? client.pepCategory) : null)
    + rowPair('Fonction exercée', client.pepFunction, 'Lien avec un pays à risque', client.hasRiskyCountryLink ? 'Oui' : 'Non'));

  const signatureSection = buildSignatureSection(
    client.kycSignedPlace, client.kycSignedAt ? formatDate(client.kycSignedAt) : null,
    isCompanyLike ? 'du représentant' : 'du client',
  );

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      ${buildKycHeader("FICHE D'IDENTIFICATION ET DE<br/>CONNAISSANCE DU CLIENT (KYC)", company, logo, client.reference, 'Date d\'édition')}
      ${identitySection}
      ${filiationSection}
      ${beneficialOwnersSection}
      ${professionalSection}
      ${fundsSection}
      ${relationshipSection}
      ${pepSection}
      ${DECLARATION_SECTION}
      ${signatureSection}
    </div>`;
}

/**
 * Fiche KYC vierge (non renseignée), imprimable/exportable depuis « Gestion
 * des clients » — même standard/même liste de rubriques que la fiche
 * générée pour un client (`buildClientKycDocumentHtml`), mais entièrement à
 * compléter à la main (lignes et cases à cocher vierges), pour un client ou
 * un agent ne disposant pas encore d'un accès à l'application. Couvre à la
 * fois les rubriques d'une personne physique et celles d'une personne
 * morale/association — à rayer ou laisser vide selon le cas.
 */
export function buildBlankKycDocumentHtml(
  company: CompanyInfo | null,
  logo: { mimeType: string; base64: string } | null,
): string {
  const identitySection = `
    ${blockTitle('1. Identification')}
    ${checkboxGroup(['Personne physique', 'Personne morale', 'Association / ONG'])}
    ${blankLine("Nom et prénoms (personne physique) / Raison sociale (personne morale)")}
    ${blankPair('Nationalité', "Pièce d'identité N°")}
    ${blankPair('Date de naissance', 'Lieu de naissance')}
    ${blankPair('Registre de commerce (RCCM)', 'Compte contribuable')}
    ${blankLine('Représentant légal (personne morale)')}
    ${blankPair('Téléphone', 'Email')}
    ${blankLine('Adresse')}`;

  const filiationSection = `
    ${blockTitle('2. Filiation (personne physique)')}
    ${blankLine('Père')}
    ${blankLine('Mère')}`;

  const beneficialOwnersSection = `
    ${blockTitle('3. Bénéficiaires effectifs (personne morale / association)')}
    ${blankTable(['Nom et prénoms', 'Nationalité', "Pièce d'identité", '% détention', 'Rôle', 'PPE'], 3)}`;

  const professionalSection = `
    ${blockTitle('4. Situation professionnelle et revenus')}
    ${blankPair('Profession', 'Employeur / activité')}
    ${blankLine('Revenu mensuel déclaré (FCFA)')}`;

  const fundsSection = `
    ${blockTitle('5. Origine des fonds et du patrimoine')}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Origine des fonds (cocher une ou plusieurs cases) :</div>
    ${checkboxGroup(SOURCE_OF_FUNDS_OPTIONS.map((o) => o.label))}
    ${blankLine('Si « Autre », précisez')}
    ${blankLine('Origine du patrimoine')}`;

  const relationshipSection = `
    ${blockTitle("6. Objet et nature de la relation d'affaires")}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Objet de la relation d'affaires (cocher une ou plusieurs cases) :</div>
    ${checkboxGroup(RELATIONSHIP_PURPOSE_OPTIONS.map((o) => o.label))}
    ${blankLine('Si « Autre », précisez')}
    ${blankPair('Volume mensuel estimé des opérations (FCFA)', "Canal d'entrée en relation")}`;

  const pepSection = `
    ${blockTitle('7. Statut PPE (Personne Politiquement Exposée)')}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Personne politiquement exposée :</div>
    ${checkboxGroup(['Oui', 'Non'])}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Si oui, catégorie :</div>
    ${checkboxGroup(Object.values(PEP_CATEGORY_LABEL))}
    ${blankLine('Fonction exercée')}
    <div style="margin-top:8px;font-size:9.5pt;color:#475569;">Lien avec un pays à risque :</div>
    ${checkboxGroup(['Oui', 'Non'])}`;

  return `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;">
      ${buildKycHeader("FICHE D'IDENTIFICATION ET DE<br/>CONNAISSANCE DU CLIENT (KYC)", company, logo, '……………………')}
      ${identitySection}
      ${filiationSection}
      ${beneficialOwnersSection}
      ${professionalSection}
      ${fundsSection}
      ${relationshipSection}
      ${pepSection}
      ${DECLARATION_SECTION}
      ${buildSignatureSection(null, null, 'du client / du représentant')}
    </div>`;
}

export const buildClientKycFooterTemplate = buildKycFooterTemplate;
