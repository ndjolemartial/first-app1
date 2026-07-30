"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerWireTransferIPC = registerWireTransferIPC;
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const db_service_1 = require("../services/db.service");
const auth_service_1 = require("../services/auth.service");
const settings_service_1 = require("../services/settings.service");
const storage_service_1 = require("../services/storage.service");
const pdf_service_1 = require("../services/pdf.service");
const wire_transfer_service_1 = require("../services/wire-transfer.service");
const logger_1 = __importDefault(require("../utils/logger"));
// Génération de l'ordre de virement et édition de son modèle : réservées aux
// SEULS SUPER_ADMIN/ADMIN (rôle exact — checkRole ne fait pas d'équivalence
// pour cette liste, cf. career-profiles.ipc.ts).
const WIRE_TRANSFER_ROLES = ['SUPER_ADMIN', 'ADMIN'];
const ser = (v) => JSON.parse(JSON.stringify(v));
const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
// Marges gauche/droite légèrement plus larges que le défaut (0.4 in) pour
// aérer le tableau à 8 colonnes de la fiche.
const WIRE_TRANSFER_PDF_MARGINS = { left: 0.6, right: 0.6 };
/** S'assure qu'un modèle d'ordre de virement existe (création unique au premier appel). */
async function ensureWireTransferTemplate(db) {
    const count = await db.wireTransferTemplate.count();
    if (count === 0) {
        await db.wireTransferTemplate.create({
            data: {
                name: 'Modèle par défaut',
                introHtml: wire_transfer_service_1.DEFAULT_WIRE_TRANSFER_INTRO_HTML,
                columnWidths: wire_transfer_service_1.DEFAULT_WIRE_TRANSFER_COLUMN_WIDTHS,
            },
        });
        logger_1.default.info('Wire transfer template seeded');
    }
    return db.wireTransferTemplate.findFirst({ orderBy: { id: 'asc' } });
}
/** Charge le logo de l'entreprise en data-URI (`data:image/...;base64,...`) ou `null`. */
async function loadCompanyLogo() {
    try {
        const map = await (0, settings_service_1.getSettings)([settings_service_1.SettingsKeys.companyLogo]);
        const logoRel = map[settings_service_1.SettingsKeys.companyLogo];
        if (!logoRel)
            return null;
        const abs = (0, storage_service_1.resolveStoragePath)(logoRel);
        if (!fs_1.default.existsSync(abs))
            return null;
        const buf = fs_1.default.readFileSync(abs);
        const ext = path_1.default.extname(logoRel).toLowerCase().replace('.', '') || 'png';
        const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
        return `data:${mime};base64,${buf.toString('base64')}`;
    }
    catch {
        return null;
    }
}
const periodSchema = zod_1.z.object({
    periodYear: zod_1.z.coerce.number().int().min(2000).max(2100),
    periodMonth: zod_1.z.coerce.number().int().min(1).max(12),
});
/**
 * Charge les bulletins validés/payés de la période (hors brouillon et
 * annulés) et construit la liste des bénéficiaires (nom complet + références
 * bancaires + net à payer), triée par montant net à payer décroissant.
 */
async function loadBeneficiaries(db, periodYear, periodMonth) {
    const payslips = await db.payslip.findMany({
        where: { periodYear, periodMonth, deletedAt: null, status: { in: ['VALIDE', 'PAYE'] } },
        include: { employee: true },
    });
    return payslips
        .map((p) => ({
        fullName: `${p.employee.lastName ?? ''} ${p.employee.firstName ?? ''}`.trim(),
        bankCode: p.employee.bankCode ?? '',
        bankGuichetCode: p.employee.bankGuichetCode ?? '',
        bankAccountNumber: p.employee.bankAccountNumber ?? '',
        bankRibKey: p.employee.bankRibKey ?? '',
        bankName: p.employee.bankName ?? '',
        netSalary: Number(p.netSalary),
    }))
        .sort((a, b) => b.netSalary - a.netSalary);
}
function periodLabel(periodYear, periodMonth) {
    return `${MONTHS_FR[periodMonth - 1]} ${periodYear}`;
}
function toTemplateOpts(t) {
    return {
        introHtml: t?.introHtml ?? null,
        tableTitle: t?.tableTitle ?? null,
        signatureLabel: t?.signatureLabel ?? null,
        signatureName: t?.signatureName ?? null,
        columnWidths: Array.isArray(t?.columnWidths) ? t.columnWidths : null,
        accentColor: t?.accentColor ?? null,
        showLogo: t?.showLogo ?? true,
    };
}
const updateTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    introHtml: zod_1.z.string().optional(),
    tableTitle: zod_1.z.string().min(1).optional(),
    signatureLabel: zod_1.z.string().min(1).optional(),
    signatureName: zod_1.z.string().optional().nullable(),
    columnWidths: zod_1.z.array(zod_1.z.coerce.number().min(1).max(100)).length(8).optional(),
    accentColor: zod_1.z.string().optional(),
    showLogo: zod_1.z.boolean().optional(),
});
function registerWireTransferIPC() {
    electron_1.ipcMain.handle('wireTransfer:getTemplate', async (_event, { token }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WIRE_TRANSFER_ROLES);
            const db = (0, db_service_1.getDb)();
            const template = await ensureWireTransferTemplate(db);
            return ser({ success: true, data: template });
        }
        catch (error) {
            logger_1.default.error('wireTransfer:getTemplate error', error.message);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('wireTransfer:updateTemplate', async (_event, { token, id, payload }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WIRE_TRANSFER_ROLES);
            const parsed = updateTemplateSchema.safeParse(payload);
            if (!parsed.success)
                return { success: false, error: parsed.error.format() };
            const db = (0, db_service_1.getDb)();
            const template = await db.wireTransferTemplate.update({ where: { id }, data: parsed.data });
            logger_1.default.info(`Wire transfer template updated: id=${id}`);
            return ser({ success: true, data: template });
        }
        catch (error) {
            logger_1.default.error('wireTransfer:updateTemplate error', error.message);
            return { success: false, error: error.message };
        }
    });
    /** Aperçu / impression : ouvre le PDF dans le visualiseur intégré (sans forcer l'enregistrement). */
    electron_1.ipcMain.handle('wireTransfer:print', async (_event, { token, periodYear, periodMonth }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WIRE_TRANSFER_ROLES);
            const parsed = periodSchema.safeParse({ periodYear, periodMonth });
            if (!parsed.success)
                return { success: false, error: 'Période invalide' };
            const db = (0, db_service_1.getDb)();
            const beneficiaries = await loadBeneficiaries(db, parsed.data.periodYear, parsed.data.periodMonth);
            if (beneficiaries.length === 0) {
                return { success: false, error: 'Aucun bulletin validé ou payé pour cette période.' };
            }
            const template = await ensureWireTransferTemplate(db);
            const logo = template?.showLogo ? await loadCompanyLogo() : null;
            const label = periodLabel(parsed.data.periodYear, parsed.data.periodMonth);
            const html = (0, wire_transfer_service_1.renderWireTransferOrderHtml)(beneficiaries, label, logo, toTemplateOpts(template));
            const pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: true, margins: WIRE_TRANSFER_PDF_MARGINS });
            await (0, pdf_service_1.openPrintPreview)(pdf, `Ordre de virement — ${label}`);
            return { success: true, data: { previewing: true } };
        }
        catch (error) {
            logger_1.default.error('wireTransfer:print error', error.message);
            return { success: false, error: error.message };
        }
    });
    /** Export PDF : enregistrement direct sur disque (boîte de dialogue). */
    electron_1.ipcMain.handle('wireTransfer:exportPdf', async (_event, { token, periodYear, periodMonth }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WIRE_TRANSFER_ROLES);
            const parsed = periodSchema.safeParse({ periodYear, periodMonth });
            if (!parsed.success)
                return { success: false, error: 'Période invalide' };
            const db = (0, db_service_1.getDb)();
            const beneficiaries = await loadBeneficiaries(db, parsed.data.periodYear, parsed.data.periodMonth);
            if (beneficiaries.length === 0) {
                return { success: false, error: 'Aucun bulletin validé ou payé pour cette période.' };
            }
            const template = await ensureWireTransferTemplate(db);
            const logo = template?.showLogo ? await loadCompanyLogo() : null;
            const label = periodLabel(parsed.data.periodYear, parsed.data.periodMonth);
            const html = (0, wire_transfer_service_1.renderWireTransferOrderHtml)(beneficiaries, label, logo, toTemplateOpts(template));
            const pdf = await (0, pdf_service_1.htmlToPdf)(html, { landscape: true, margins: WIRE_TRANSFER_PDF_MARGINS });
            const parent = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0] ?? undefined;
            const fileName = `ordre-virement-${parsed.data.periodYear}-${String(parsed.data.periodMonth).padStart(2, '0')}`;
            const result = await electron_1.dialog.showSaveDialog(parent, {
                title: 'Exporter l\'ordre de virement (PDF)',
                defaultPath: path_1.default.join(electron_1.app.getPath('documents'), `${fileName}.pdf`),
                filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
            });
            if (result.canceled || !result.filePath)
                return { success: true, data: { canceled: true } };
            fs_1.default.writeFileSync(result.filePath, pdf);
            logger_1.default.info(`Ordre de virement PDF exporté: ${result.filePath} (${beneficiaries.length} bénéficiaires)`);
            return { success: true, data: { path: result.filePath } };
        }
        catch (error) {
            logger_1.default.error('wireTransfer:exportPdf error', error.message);
            return { success: false, error: error.message };
        }
    });
    /** Export Excel : enregistrement direct sur disque (boîte de dialogue). */
    electron_1.ipcMain.handle('wireTransfer:exportExcel', async (_event, { token, periodYear, periodMonth }) => {
        try {
            const session = (0, auth_service_1.getSession)(token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            (0, auth_service_1.checkRole)(session, WIRE_TRANSFER_ROLES);
            const parsed = periodSchema.safeParse({ periodYear, periodMonth });
            if (!parsed.success)
                return { success: false, error: 'Période invalide' };
            const db = (0, db_service_1.getDb)();
            const beneficiaries = await loadBeneficiaries(db, parsed.data.periodYear, parsed.data.periodMonth);
            if (beneficiaries.length === 0) {
                return { success: false, error: 'Aucun bulletin validé ou payé pour cette période.' };
            }
            const template = await ensureWireTransferTemplate(db);
            const logo = template?.showLogo ? await loadCompanyLogo() : null;
            const label = periodLabel(parsed.data.periodYear, parsed.data.periodMonth);
            const xlsx = await (0, wire_transfer_service_1.buildWireTransferXlsx)(beneficiaries, label, toTemplateOpts(template), logo);
            const parent = electron_1.BrowserWindow.getFocusedWindow() ?? electron_1.BrowserWindow.getAllWindows()[0] ?? undefined;
            const fileName = `ordre-virement-${parsed.data.periodYear}-${String(parsed.data.periodMonth).padStart(2, '0')}`;
            const result = await electron_1.dialog.showSaveDialog(parent, {
                title: 'Exporter l\'ordre de virement (Excel)',
                defaultPath: path_1.default.join(electron_1.app.getPath('documents'), `${fileName}.xlsx`),
                filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }],
            });
            if (result.canceled || !result.filePath)
                return { success: true, data: { canceled: true } };
            fs_1.default.writeFileSync(result.filePath, xlsx);
            logger_1.default.info(`Ordre de virement Excel exporté: ${result.filePath} (${beneficiaries.length} bénéficiaires)`);
            return { success: true, data: { path: result.filePath } };
        }
        catch (error) {
            logger_1.default.error('wireTransfer:exportExcel error', error.message);
            return { success: false, error: error.message };
        }
    });
}
