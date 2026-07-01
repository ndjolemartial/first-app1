"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONTRACT_TEMPLATE_DEFS = exports.CONTRACT_SIGN_HTML = exports.CONTRACT_PARTIES_HTML = exports.CONTRACT_HEADER_HTML = void 0;
exports.loadContractCompany = loadContractCompany;
const settings_service_1 = require("./settings.service");
const db_service_1 = require("./db.service");
async function loadContractCompany() {
    const map = await (0, settings_service_1.getSettings)([
        settings_service_1.SettingsKeys.companyName,
        settings_service_1.SettingsKeys.companyDenomination,
        settings_service_1.SettingsKeys.companyLegalRepEmployeeId,
        settings_service_1.SettingsKeys.companyRegistre,
        settings_service_1.SettingsKeys.companyContribuable,
        settings_service_1.SettingsKeys.companyAddress,
        settings_service_1.SettingsKeys.companyPhoneFixed,
    ]);
    // Représentant légal : employé sélectionné dans les paramètres entreprise.
    let legalRep = null;
    const repId = Number(map[settings_service_1.SettingsKeys.companyLegalRepEmployeeId]);
    if (Number.isInteger(repId) && repId > 0) {
        const emp = await (0, db_service_1.getDb)().employee.findFirst({
            where: { id: repId, deletedAt: null },
            select: { civilite: true, firstName: true, lastName: true, poste: true },
        });
        if (emp) {
            legalRep = {
                civilite: emp.civilite ?? '',
                firstName: emp.firstName ?? '',
                lastName: emp.lastName ?? '',
                poste: emp.poste ?? '',
            };
        }
    }
    return {
        name: map[settings_service_1.SettingsKeys.companyName] ?? 'AFRIKIMMO',
        denomination: map[settings_service_1.SettingsKeys.companyDenomination] ?? '',
        registre: map[settings_service_1.SettingsKeys.companyRegistre] ?? '',
        contribuable: map[settings_service_1.SettingsKeys.companyContribuable] ?? '',
        address: map[settings_service_1.SettingsKeys.companyAddress] ?? '',
        phone: map[settings_service_1.SettingsKeys.companyPhoneFixed] ?? '',
        legalRep,
    };
}
const CONTRACT_TYPE_LABEL = {
    CDI: 'Contrat à Durée Indéterminée',
    CDD: 'Contrat à Durée Déterminée',
    STAGE: 'Convention de Stage',
    INTERIM: "Contrat de Travail Temporaire (Intérim)",
    CONSULTANT: 'Contrat de Prestation / Consultance',
    APPRENTISSAGE: "Contrat d'Apprentissage",
    ESSAI: "Contrat à l'Essai",
    AVENANT_CDD: 'Avenant à un Contrat à Durée Déterminée',
    RENOUVELLEMENT_ESSAI: "Lettre de Renouvellement de la Période d'Essai",
};
const art = (n, html) => `<p class="art"><strong>${n}</strong></p><p>${html}</p>`;
/**
 * Clauses (articles) spécifiques à chaque type de contrat. Le papier à
 * en-tête, le préambule des parties et le bloc de signature sont fournis par
 * les fragments de zones ci-dessous (CONTRACT_HEADER_HTML / PARTIES / SIGN).
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
    ESSAI: art('Article 1 — Engagement à l\'essai', `{{entreprise.nom}} engage {{employe.civilite}} {{employe.nomComplet}} en qualité de <strong>{{contrat.poste}}</strong> (catégorie {{contrat.categorie}}) dans le cadre d'un contrat à l'essai, conformément à la Loi n°2015-532 portant Code du travail de la République de Côte d'Ivoire.`) +
        art('Article 2 — Durée de l\'essai', `La période d'essai débute le <strong>{{contrat.dateDebut}}</strong> et expire le <strong>{{contrat.finEssai}}</strong>, conformément au délai applicable à la catégorie socio-professionnelle du salarié. Elle a pour objet de permettre à l'employeur d'apprécier les compétences du salarié et à ce dernier d'évaluer si les fonctions lui conviennent.`) +
        art('Article 3 — Fonctions', `Le salarié exercera les fonctions de {{contrat.poste}} et toute tâche connexe relevant de sa qualification. Il s'engage à respecter le règlement intérieur et les consignes de l'employeur.`) +
        art('Article 4 — Durée du travail', `La durée hebdomadaire de travail est fixée à <strong>{{contrat.heuresHebdo}} heures</strong>, répartie selon l'horaire en vigueur dans l'entreprise.`) +
        art('Article 5 — Rémunération', `Pendant la période d'essai, le salarié percevra un salaire de base mensuel brut de <strong>{{contrat.salaireBase}}</strong>, sous déduction des cotisations sociales (CNPS) et fiscales (ITS) légales.`) +
        art('Article 6 — Sécurité sociale', `Le salarié est affilié à la Caisse Nationale de Prévoyance Sociale (CNPS). Numéro CNPS : {{employe.cnps}}.`) +
        art('Article 7 — Rupture pendant l\'essai', `Durant la période d'essai, chacune des parties peut rompre le contrat sans préavis ni indemnité, conformément à la réglementation en vigueur. À l'issue de l'essai jugé concluant, la relation de travail se poursuit dans les conditions convenues entre les parties.`),
    AVENANT_CDD: art('Article 1 — Objet de l\'avenant', `Le présent avenant a pour objet la prolongation du contrat de travail à durée déterminée n° <strong>{{contratParent.reference}}</strong>, conclu entre les parties et initialement prévu du <strong>{{contratParent.dateDebut}}</strong> au <strong>{{contratParent.dateFin}}</strong>.`) +
        art('Article 2 — Prolongation du terme', `Les parties conviennent de prolonger le contrat susvisé jusqu'au <strong>{{contrat.dateFin}}</strong>. Conformément à la Loi n°2015-532 portant Code du travail, la durée cumulée du contrat initial et de ses avenants successifs n'excède pas deux (2) ans.`) +
        art('Article 3 — Maintien des autres clauses', `Toutes les autres clauses et conditions du contrat de travail initial n° {{contratParent.reference}} non modifiées par le présent avenant demeurent inchangées et continuent de produire leurs effets.`) +
        art('Article 4 — Rémunération', `Pendant la période de prolongation, le salarié percevra un salaire de base mensuel brut de <strong>{{contrat.salaireBase}}</strong>, sous déduction des cotisations sociales (CNPS) et fiscales (ITS) légales.`),
    RENOUVELLEMENT_ESSAI: art('Article 1 — Objet', `La présente lettre a pour objet le renouvellement de la période d'essai prévue par le contrat à l'essai n° <strong>{{contratParent.reference}}</strong>, conclu pour la période du <strong>{{contratParent.dateDebut}}</strong> au <strong>{{contratParent.dateFin}}</strong>.`) +
        art('Article 2 — Durée du renouvellement', `La période d'essai est renouvelée une seule fois, pour une durée <strong>égale à celle de l'essai initial</strong>, soit du <strong>{{contrat.dateDebut}}</strong> au <strong>{{contrat.dateFin}}</strong>, conformément à la Loi n°2015-532 portant Code du travail et au délai applicable à la catégorie socio-professionnelle du salarié.`) +
        art('Article 3 — Conditions', `Durant cette période de renouvellement, chacune des parties peut rompre le contrat sans préavis ni indemnité, conformément à la réglementation en vigueur. Toutes les autres conditions du contrat à l'essai initial demeurent inchangées.`) +
        art('Article 4 — Confirmation', `À l'issue du renouvellement jugé concluant, la relation de travail se poursuit dans les conditions convenues entre les parties.`),
};
/**
 * Papier à en-tête entreprise (zone En-tête) — répété en haut de chaque page.
 * Les coordonnées proviennent des variables {{entreprise.*}}.
 */
exports.CONTRACT_HEADER_HTML = '<div style="text-align:center;">' +
    '<p style="font-size:16pt;font-weight:bold;color:#1E3A5F;margin:0;">{{entreprise.nom}}</p>' +
    '<p style="font-size:9pt;color:#475569;margin:1pt 0 0;">{{entreprise.adresse}} — Tél : {{entreprise.telephone}}</p>' +
    '<p style="font-size:9pt;color:#475569;margin:0;">RCCM : {{entreprise.rccm}} — Cpte contribuable : {{entreprise.contribuable}}</p>' +
    '</div>';
/**
 * Titre, référence et préambule d'identification des parties (début du Corps).
 * Le bloc CNPS n'apparaît que pour les contrats de travail
 * ({{#si contrat.estContratTravail}}).
 */
exports.CONTRACT_PARTIES_HTML = '<h1 style="text-align:center;text-transform:uppercase;color:#1E3A5F;">{{contrat.typeLibelle}}</h1>' +
    '<p style="text-align:center;color:#64748b;font-size:11px;">Référence : {{contrat.reference}}</p>' +
    '<p><strong>ENTRE LES SOUSSIGNÉS :</strong></p>' +
    '<p>{{entreprise.nom}}, immatriculée au RCCM sous le n° {{entreprise.rccm}}, dont le siège est à {{entreprise.adresse}}, ci-après dénommée « l\'Employeur »,</p>' +
    '<p><strong>D\'UNE PART,</strong></p>' +
    '<p>{{employe.civilite}} {{employe.nomComplet}}, né(e) le {{employe.dateNaissance}} à {{employe.lieuNaissance}}, de nationalité {{employe.nationalite}}, demeurant à {{employe.adresse}}, titulaire de la pièce d\'identité n° {{employe.pieceIdentite}}{{#si contrat.estContratTravail}}, immatriculé(e) à la CNPS sous le n° {{employe.cnps}}{{/si}}, ci-après dénommé(e) « {{contrat.signataireEmploye}} »,</p>' +
    '<p><strong>D\'AUTRE PART,</strong></p>' +
    '<p style="font-style:italic;">Il a été convenu et arrêté ce qui suit :</p>';
/**
 * Lieu, date et bloc de signature (zone Fin du document) — inséré une seule
 * fois à la suite du corps.
 */
exports.CONTRACT_SIGN_HTML = '<p style="margin-top:8px;">Fait à {{lieu}}, le {{date.aujourdhui}}, en deux (2) exemplaires originaux.</p>' +
    '<table style="width:100%;margin-top:24px;border-collapse:collapse;"><tr>' +
    '<td style="width:50%;text-align:center;vertical-align:top;"><p style="font-weight:bold;margin:0 0 56px;">Pour l\'Employeur</p><p style="border-top:1px solid #94a3b8;padding-top:4px;margin:0;font-size:11px;">{{entreprise.nom}}</p></td>' +
    '<td style="width:50%;text-align:center;vertical-align:top;"><p style="font-weight:bold;margin:0 0 56px;">{{contrat.signataireEmploye}}</p><p style="border-top:1px solid #94a3b8;padding-top:4px;margin:0;font-size:11px;">{{employe.nomComplet}}</p></td>' +
    '</tr></table>';
/**
 * Définitions de seed des modèles par défaut (un par type). Chaque modèle
 * fournit ses zones En-tête / Corps / Fin du document ; le pied de page est
 * laissé vide (le numéro de page est ajouté automatiquement au rendu).
 */
exports.CONTRACT_TEMPLATE_DEFS = Object.keys(TEMPLATES).map((type) => ({
    type,
    name: `${CONTRACT_TYPE_LABEL[type] ?? type} (modèle par défaut)`,
    header: exports.CONTRACT_HEADER_HTML,
    body: exports.CONTRACT_PARTIES_HTML + TEMPLATES[type],
    endOfDocument: exports.CONTRACT_SIGN_HTML,
}));
