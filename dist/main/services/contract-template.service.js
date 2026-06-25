"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRACT_TEMPLATE_DEFS = void 0;
exports.loadContractCompany = loadContractCompany;
exports.renderContractHtml = renderContractHtml;
const settings_service_1 = require("./settings.service");
async function loadContractCompany() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.companyName,
        settings_service_1.SettingsKeys.companyRegistre,
        settings_service_1.SettingsKeys.companyContribuable,
        settings_service_1.SettingsKeys.companyAddress,
        settings_service_1.SettingsKeys.companyPhoneFixed,
    ]);
    return {
        name: map[settings_service_1.SettingsKeys.companyName] ?? 'AFRIKIMMO',
        registre: map[settings_service_1.SettingsKeys.companyRegistre] ?? '',
        contribuable: map[settings_service_1.SettingsKeys.companyContribuable] ?? '',
        address: map[settings_service_1.SettingsKeys.companyAddress] ?? '',
        phone: map[settings_service_1.SettingsKeys.companyPhoneFixed] ?? '',
    };
}
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('fr-FR') : '………………');
const fmtMoney = (n) => n != null && n !== ''
    ? `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(n)))} FCFA`
    : '………………';
const CIVILITE_LABEL = {
    MONSIEUR: 'Monsieur', MADAME: 'Madame', MADEMOISELLE: 'Mademoiselle',
};
const CONTRACT_TYPE_LABEL = {
    CDI: 'Contrat à Durée Indéterminée',
    CDD: 'Contrat à Durée Déterminée',
    STAGE: 'Convention de Stage',
    INTERIM: "Contrat de Travail Temporaire (Intérim)",
    CONSULTANT: 'Contrat de Prestation / Consultance',
    APPRENTISSAGE: "Contrat d'Apprentissage",
};
/** Construit la table des variables substituables d'un contrat. */
function buildVariables(contract, employee, company) {
    const nom = `${employee.lastName ?? ''} ${employee.firstName ?? ''}`.trim();
    const civ = employee.civilite ? CIVILITE_LABEL[employee.civilite] ?? '' : '';
    return {
        'entreprise.nom': company.name,
        'entreprise.rccm': company.registre || '………………',
        'entreprise.contribuable': company.contribuable || '………………',
        'entreprise.adresse': company.address || '………………',
        'entreprise.telephone': company.phone || '………………',
        'employe.civilite': civ,
        'employe.nomComplet': nom || '………………',
        'employe.nom': employee.lastName ?? '………………',
        'employe.prenoms': employee.firstName ?? '………………',
        'employe.dateNaissance': fmtDate(employee.birthDate),
        'employe.lieuNaissance': employee.birthPlace || '………………',
        'employe.nationalite': employee.nationality || '………………',
        'employe.adresse': [employee.address, employee.city].filter(Boolean).join(', ') || '………………',
        'employe.pieceIdentite': employee.idNumber || '………………',
        'employe.cnps': employee.cnpsNumber || '………………',
        'employe.matricule': employee.matricule ?? '',
        'contrat.reference': contract.reference ?? '',
        'contrat.typeLibelle': CONTRACT_TYPE_LABEL[contract.type] ?? contract.type,
        'contrat.poste': contract.poste || '………………',
        'contrat.categorie': contract.categorie || '………………',
        'contrat.dateDebut': fmtDate(contract.startDate),
        'contrat.dateFin': fmtDate(contract.endDate),
        'contrat.finEssai': fmtDate(contract.trialEndDate),
        'contrat.heuresHebdo': contract.weeklyHours != null ? String(contract.weeklyHours) : '40',
        'contrat.salaireBase': fmtMoney(contract.baseSalary),
        'contrat.sursalaire': fmtMoney(contract.sursalaire),
        'contrat.primeAnciennete': fmtMoney(contract.primeAnciennete),
        'contrat.salaireBrut': fmtMoney(contract.grossSalary),
        'contrat.its': fmtMoney(contract.its),
        'contrat.cnps': fmtMoney(contract.cnps),
        'contrat.totalRetenues': fmtMoney(contract.totalDeductions),
        'contrat.transport': fmtMoney(contract.transportAllowance),
        'contrat.salaireNet': fmtMoney(contract.netSalary),
        'lieu': employee.city || 'Abidjan',
        'date.aujourdhui': fmtDate(new Date()),
    };
}
const art = (n, html) => `<p class="art"><strong>${n}</strong></p><p>${html}</p>`;
/**
 * Clauses spécifiques à chaque type de contrat. Le préambule, l'identification
 * des parties et les signatures sont communs (cf. renderContractHtml).
 */
const TEMPLATES = {
    CDI: art('Article 1 — Engagement', `{{entreprise.nom}} engage {{employe.civilite}} {{employe.nomComplet}} en qualité de <strong>{{contrat.poste}}</strong> (catégorie {{contrat.categorie}}), dans le cadre d'un contrat de travail à durée indéterminée régi par la Loi n°2015-532 portant Code du travail de la République de Côte d'Ivoire et la convention collective applicable.`) +
        art('Article 2 — Prise d\'effet et période d\'essai', `Le présent contrat prend effet à compter du <strong>{{contrat.dateDebut}}</strong>. Il est assorti d'une période d'essai expirant le {{contrat.finEssai}}, durant laquelle chacune des parties peut rompre le contrat sans préavis ni indemnité, conformément à la réglementation en vigueur.`) +
        art('Article 3 — Fonctions', `Le salarié exercera les fonctions de {{contrat.poste}} et toute tâche connexe relevant de sa qualification. Il s'engage à respecter le règlement intérieur et les consignes de l'employeur.`) +
        art('Article 4 — Durée du travail', `La durée hebdomadaire de travail est fixée à <strong>{{contrat.heuresHebdo}} heures</strong>, répartie selon l'horaire en vigueur dans l'entreprise.`) +
        art('Article 5 — Rémunération', `En contrepartie de son travail, le salarié percevra un salaire de base mensuel brut de <strong>{{contrat.salaireBase}}</strong>, payable à terme échu, sous déduction des cotisations sociales (CNPS) et fiscales (ITS) légales.`) +
        art('Article 6 — Sécurité sociale', `Le salarié est affilié à la Caisse Nationale de Prévoyance Sociale (CNPS). Numéro CNPS : {{employe.cnps}}.`) +
        art('Article 7 — Rupture', `La rupture du présent contrat obéit aux dispositions du Code du travail relatives au préavis, au licenciement et à la démission.`),
    CDD: art('Article 1 — Engagement et durée', `{{entreprise.nom}} engage {{employe.civilite}} {{employe.nomComplet}} en qualité de <strong>{{contrat.poste}}</strong> dans le cadre d'un contrat à durée déterminée, conclu du <strong>{{contrat.dateDebut}}</strong> au <strong>{{contrat.dateFin}}</strong>, conformément à la Loi n°2015-532 portant Code du travail.`) +
        art('Article 2 — Motif et période d\'essai', `Le présent contrat est conclu pour faire face à un besoin déterminé de l'entreprise. Il comporte une période d'essai expirant le {{contrat.finEssai}}.`) +
        art('Article 3 — Fonctions et durée du travail', `Le salarié exercera les fonctions de {{contrat.poste}} (catégorie {{contrat.categorie}}), pour une durée hebdomadaire de <strong>{{contrat.heuresHebdo}} heures</strong>.`) +
        art('Article 4 — Rémunération', `Le salaire de base mensuel brut est fixé à <strong>{{contrat.salaireBase}}</strong>, sous déduction des cotisations CNPS et de l'ITS.`) +
        art('Article 5 — Fin du contrat', `Le contrat prend fin de plein droit à l'arrivée du terme convenu, sans préavis. Le renouvellement éventuel s'effectue dans les limites fixées par le Code du travail.`) +
        art('Article 6 — Sécurité sociale', `Le salarié est affilié à la CNPS sous le numéro {{employe.cnps}}.`),
    STAGE: art('Article 1 — Objet', `La présente convention a pour objet l'accueil de {{employe.civilite}} {{employe.nomComplet}} en qualité de stagiaire au poste de <strong>{{contrat.poste}}</strong> au sein de {{entreprise.nom}}, à des fins de formation pratique.`) +
        art('Article 2 — Durée', `Le stage se déroule du <strong>{{contrat.dateDebut}}</strong> au <strong>{{contrat.dateFin}}</strong>, pour une durée hebdomadaire de {{contrat.heuresHebdo}} heures.`) +
        art('Article 3 — Gratification', `Le stagiaire perçoit une gratification mensuelle de <strong>{{contrat.salaireBase}}</strong>. La présente convention ne constitue pas un contrat de travail.`) +
        art('Article 4 — Encadrement et obligations', `Le stagiaire est placé sous la responsabilité d'un maître de stage et s'engage à respecter le règlement intérieur et la confidentialité des informations de l'entreprise.`),
    INTERIM: art('Article 1 — Objet et durée', `{{entreprise.nom}} engage {{employe.civilite}} {{employe.nomComplet}} dans le cadre d'un contrat de travail temporaire au poste de <strong>{{contrat.poste}}</strong>, du <strong>{{contrat.dateDebut}}</strong> au <strong>{{contrat.dateFin}}</strong>.`) +
        art('Article 2 — Mission', `Le salarié est mis à disposition pour l'accomplissement d'une mission temporaire correspondant à la catégorie {{contrat.categorie}}, pour {{contrat.heuresHebdo}} heures hebdomadaires.`) +
        art('Article 3 — Rémunération', `La rémunération mensuelle brute est fixée à <strong>{{contrat.salaireBase}}</strong>, soumise aux retenues CNPS et ITS.`) +
        art('Article 4 — Fin de mission', `Le contrat prend fin à l'échéance de la mission, conformément aux dispositions légales applicables au travail temporaire.`),
    CONSULTANT: art('Article 1 — Objet', `{{entreprise.nom}} confie à {{employe.civilite}} {{employe.nomComplet}} une mission de prestation de services / consultance en qualité de <strong>{{contrat.poste}}</strong>.`) +
        art('Article 2 — Durée', `La mission est exécutée du <strong>{{contrat.dateDebut}}</strong> au <strong>{{contrat.dateFin}}</strong>.`) +
        art('Article 3 — Honoraires', `En contrepartie de ses prestations, le consultant perçoit une rémunération mensuelle de <strong>{{contrat.salaireBase}}</strong>. Le consultant fait son affaire personnelle de ses obligations fiscales et sociales, sauf disposition contraire.`) +
        art('Article 4 — Indépendance et confidentialité', `Le consultant exécute sa mission en toute indépendance et s'engage à une stricte confidentialité sur les informations dont il a connaissance.`),
    APPRENTISSAGE: art('Article 1 — Objet', `{{entreprise.nom}} s'engage à donner à {{employe.civilite}} {{employe.nomComplet}} une formation professionnelle méthodique et complète au métier de <strong>{{contrat.poste}}</strong>, dans le cadre d'un contrat d'apprentissage.`) +
        art('Article 2 — Durée', `L'apprentissage se déroule du <strong>{{contrat.dateDebut}}</strong> au <strong>{{contrat.dateFin}}</strong>, à raison de {{contrat.heuresHebdo}} heures hebdomadaires.`) +
        art('Article 3 — Allocation', `L'apprenti perçoit une allocation mensuelle de <strong>{{contrat.salaireBase}}</strong>.`) +
        art('Article 4 — Obligations', `L'apprenti s'engage à suivre la formation avec assiduité et à respecter le règlement intérieur. L'employeur s'engage à assurer la formation et l'encadrement nécessaires.`),
};
/** Corps (articles) par défaut, exposés pour le seeding des modèles éditables. */
exports.CONTRACT_TEMPLATE_DEFS = Object.keys(TEMPLATES).map((type) => ({
    type,
    name: `${CONTRACT_TYPE_LABEL[type] ?? type} (modèle par défaut)`,
    body: TEMPLATES[type],
}));
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** Substitue les variables {{token}} (les valeurs sont échappées). */
function merge(html, vars) {
    return html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_m, token) => Object.prototype.hasOwnProperty.call(vars, token) ? esc(vars[token]) : `{{${token}}}`);
}
/**
 * Construit le document HTML imprimable d'un contrat de travail (A4 portrait).
 * `bodyOverride` : corps issu d'un modèle éditable en base ; à défaut, modèle
 * intégré correspondant au type de contrat.
 */
function renderContractHtml(contract, employee, company, bodyOverride) {
    const vars = buildVariables(contract, employee, company);
    const typeLabel = CONTRACT_TYPE_LABEL[contract.type] ?? contract.type;
    const isWorkContract = !['STAGE', 'CONSULTANT'].includes(contract.type);
    const employerLabel = "Pour l'Employeur";
    const employeeLabel = contract.type === 'STAGE' ? 'Le Stagiaire'
        : contract.type === 'CONSULTANT' ? 'Le Consultant'
            : contract.type === 'APPRENTISSAGE' ? "L'Apprenti"
                : 'Le Salarié';
    const template = bodyOverride && bodyOverride.trim() ? bodyOverride : (TEMPLATES[contract.type] ?? TEMPLATES.CDI);
    const body = merge(template, vars);
    const companyLines = [
        company.address && esc(company.address),
        company.phone && `Tél : ${esc(company.phone)}`,
        company.registre && `RCCM : ${esc(company.registre)}`,
        company.contribuable && `Cpte contribuable : ${esc(company.contribuable)}`,
    ].filter(Boolean);
    return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12.5px; line-height: 1.5; }
  .head { text-align: center; border-bottom: 2px solid #1E3A5F; padding-bottom: 10px; }
  .head .company { font-size: 18px; font-weight: bold; color: #1E3A5F; }
  .head .lines { font-size: 11px; color: #475569; margin-top: 2px; }
  h1 { text-align: center; font-size: 17px; color: #1E3A5F; margin: 22px 0 4px; text-transform: uppercase; }
  .ref { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 18px; }
  .parties { margin: 14px 0; }
  .parties p { margin: 4px 0; }
  p { margin: 6px 0; text-align: justify; }
  p.art { margin-top: 14px; color: #1E3A5F; }
  .preambule { font-style: italic; color: #334155; }
  .sign { margin-top: 40px; display: flex; justify-content: space-between; gap: 40px; }
  .sign div { width: 45%; text-align: center; }
  .sign .role { font-weight: bold; margin-bottom: 60px; }
  .sign .line { border-top: 1px solid #94a3b8; padding-top: 4px; font-size: 11px; color: #64748b; }
  .place { margin-top: 28px; font-size: 12px; }
</style></head><body>
  <div class="head">
    <div class="company">${esc(company.name)}</div>
    <div class="lines">${companyLines.join(' — ')}</div>
  </div>

  <h1>${esc(typeLabel)}</h1>
  <div class="ref">Référence : ${esc(contract.reference ?? '')}</div>

  <div class="parties">
    <p><strong>ENTRE LES SOUSSIGNÉS :</strong></p>
    <p>${esc(company.name)}, ${company.registre ? `immatriculée au RCCM sous le n° ${esc(company.registre)}, ` : ''}dont le siège est à ${esc(company.address || '………………')}, ci-après dénommée « l'Employeur »,</p>
    <p><strong>D'UNE PART,</strong></p>
    <p>${esc(vars['employe.civilite'])} ${esc(vars['employe.nomComplet'])}, né(e) le ${esc(vars['employe.dateNaissance'])} à ${esc(vars['employe.lieuNaissance'])}, de nationalité ${esc(vars['employe.nationalite'])}, demeurant à ${esc(vars['employe.adresse'])}, titulaire de la pièce d'identité n° ${esc(vars['employe.pieceIdentite'])}${isWorkContract ? `, immatriculé(e) à la CNPS sous le n° ${esc(vars['employe.cnps'])}` : ''}, ci-après dénommé(e) « ${employeeLabel} »,</p>
    <p><strong>D'AUTRE PART,</strong></p>
    <p class="preambule">Il a été convenu et arrêté ce qui suit :</p>
  </div>

  ${body}

  <div class="place">Fait à ${esc(vars['lieu'])}, le ${esc(vars['date.aujourdhui'])}, en deux (2) exemplaires originaux.</div>

  <div class="sign">
    <div>
      <div class="role">${employerLabel}</div>
      <div class="line">${esc(company.name)}</div>
    </div>
    <div>
      <div class="role">${employeeLabel}</div>
      <div class="line">${esc(vars['employe.nomComplet'])}</div>
    </div>
  </div>
</body></html>`;
}
