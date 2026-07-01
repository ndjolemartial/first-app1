"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedDefaultContractTemplates = seedDefaultContractTemplates;
exports.seedDefaultEssaiCategories = seedDefaultEssaiCategories;
exports.seedDefaultPayslipTemplates = seedDefaultPayslipTemplates;
exports.resolvePayslipTemplate = resolvePayslipTemplate;
const db_service_1 = require("./db.service");
const logger_1 = __importDefault(require("../utils/logger"));
const contract_template_service_1 = require("./contract-template.service");
/**
 * Seeding et résolution des modèles éditables RH :
 *  - modèles de contrats de travail (un par défaut par type) ;
 *  - modèles de bulletins de paie (3 mises en page MODELE_1/2/3).
 * Idempotent : ne réécrit jamais un modèle déjà présent (préserve les éditions).
 */
/**
 * Crée les modèles de contrats par défaut absents (un par type) avec leurs
 * zones En-tête / Corps / Fin du document.
 *
 * **Upgrade idempotent** : pour les installations antérieures où le modèle par
 * défaut « (modèle par défaut) » ne contenait qu'un corps (zones En-tête /
 * Fin du document vides — l'en-tête et les signatures étaient codés en dur au
 * rendu), on remplit ces zones et on préfixe le préambule des parties au corps.
 * Un modèle déjà doté d'un en-tête (édité par l'utilisateur) n'est jamais touché.
 */
async function seedDefaultContractTemplates() {
    const db = (0, db_service_1.getDb)();
    for (const def of contract_template_service_1.CONTRACT_TEMPLATE_DEFS) {
        const existing = await db.contractTemplate.findFirst({
            where: { type: def.type, deletedAt: null },
            orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
            select: { id: true, name: true, header: true, body: true, endOfDocument: true },
        });
        if (!existing) {
            await db.contractTemplate.create({
                data: {
                    name: def.name, type: def.type,
                    header: def.header, body: def.body, endOfDocument: def.endOfDocument,
                    isDefault: true, isActive: true,
                },
            });
            continue;
        }
        // Upgrade des seeds historiques (corps seul) vers le système de zones.
        const isLegacySeed = existing.name.includes('(modèle par défaut)')
            && (!existing.header || existing.header.trim() === '');
        if (isLegacySeed) {
            const hasParties = (existing.body ?? '').includes('ENTRE LES SOUSSIGNÉS');
            await db.contractTemplate.update({
                where: { id: existing.id },
                data: {
                    header: contract_template_service_1.CONTRACT_HEADER_HTML,
                    body: hasParties ? existing.body : contract_template_service_1.CONTRACT_PARTIES_HTML + (existing.body ?? ''),
                    endOfDocument: (existing.endOfDocument && existing.endOfDocument.trim() !== '')
                        ? existing.endOfDocument
                        : contract_template_service_1.CONTRACT_SIGN_HTML,
                },
            });
            logger_1.default.info(`Modèle de contrat ${def.type} migré vers le système de zones`);
        }
    }
}
const PAYSLIP_SEED = [
    { name: 'Bulletin — Modèle 1 (Classique)', layout: 'MODELE_1', isDefault: true },
    { name: 'Bulletin — Modèle 2 (Moderne)', layout: 'MODELE_2', isDefault: false },
    { name: 'Bulletin — Modèle 3 (Compact)', layout: 'MODELE_3', isDefault: false },
];
// Délais d'essai par catégorie socio-professionnelle (contexte ivoirien,
// renouvelable une fois). Valeurs de référence — paramétrables ensuite.
const ESSAI_CATEGORY_SEED = [
    { label: "Travailleurs payés à l'heure ou à la journée", durationValue: 8, durationUnit: 'JOURS' },
    { label: 'Employés et ouvriers (payés au mois)', durationValue: 1, durationUnit: 'MOIS' },
    { label: 'Agents de maîtrise, techniciens et assimilés', durationValue: 2, durationUnit: 'MOIS' },
    { label: 'Cadres, ingénieurs et assimilés', durationValue: 3, durationUnit: 'MOIS' },
];
/** Crée les catégories socio-professionnelles d'essai par défaut si aucune n'existe. */
async function seedDefaultEssaiCategories() {
    const db = (0, db_service_1.getDb)();
    const count = await db.essaiCategory.count();
    if (count > 0)
        return;
    for (const c of ESSAI_CATEGORY_SEED) {
        await db.essaiCategory.create({ data: { ...c, isActive: true } });
    }
    logger_1.default.info("Catégories socio-professionnelles d'essai créées (valeurs par défaut)");
}
/** Crée les 3 modèles de bulletins par défaut si aucun n'existe. */
async function seedDefaultPayslipTemplates() {
    const db = (0, db_service_1.getDb)();
    const count = await db.payslipTemplate.count();
    if (count > 0)
        return;
    for (const t of PAYSLIP_SEED) {
        await db.payslipTemplate.create({
            data: { name: t.name, layout: t.layout, isDefault: t.isDefault, isActive: true },
        });
    }
    logger_1.default.info('Modèles de bulletins de paie créés (3 modèles)');
}
/** Résout le modèle de bulletin par défaut (ou le premier actif). */
async function resolvePayslipTemplate() {
    const db = (0, db_service_1.getDb)();
    const tpl = await db.payslipTemplate.findFirst({
        where: { isActive: true },
        orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
        select: { layout: true, headerHtml: true, footerHtml: true, accentColor: true },
    });
    return tpl ?? null;
}
