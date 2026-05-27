"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerDocumentExportIPC = registerDocumentExportIPC;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const auth_service_1 = require("../services/auth.service");
const pdf_service_1 = require("../services/pdf.service");
const docx_service_1 = require("../services/docx.service");
const logger_1 = __importDefault(require("../utils/logger"));
/**
 * Export PDF d'un document de convention ou d'attestation avec en-tête et
 * pied de page répétés sur chaque page (via le moteur natif Chromium
 * `displayHeaderFooter` de `printToPDF`).
 */
const payloadSchema = zod_1.z.object({
    token: zod_1.z.string(),
    fileName: zod_1.z.string().min(1),
    bodyHtml: zod_1.z.string(),
    headerTemplate: zod_1.z.string(),
    footerTemplate: zod_1.z.string(),
    headerMm: zod_1.z.number().positive(),
    footerMm: zod_1.z.number().positive(),
});
function registerDocumentExportIPC() {
    electron_1.ipcMain.handle('documents:exportDocumentPdf', async (_event, payload) => {
        try {
            const parsed = payloadSchema.safeParse(payload);
            if (!parsed.success) {
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            }
            const session = (0, auth_service_1.getSession)(parsed.data.token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const { canceled, filePath } = await electron_1.dialog.showSaveDialog({
                defaultPath: `${parsed.data.fileName}.pdf`,
                filters: [{ name: 'PDF', extensions: ['pdf'] }],
            });
            if (canceled || !filePath)
                return { success: true, data: { canceled: true } };
            const pdf = await (0, pdf_service_1.htmlToPdfWithTemplates)(parsed.data.bodyHtml, parsed.data.headerTemplate, parsed.data.footerTemplate, parsed.data.headerMm, parsed.data.footerMm);
            fs_1.default.writeFileSync(filePath, pdf);
            electron_1.shell.showItemInFolder(filePath);
            logger_1.default.info(`Document PDF exporté : ${filePath}`);
            return { success: true, data: { filePath, canceled: false } };
        }
        catch (err) {
            logger_1.default.error('documents:exportDocumentPdf', err.message);
            return { success: false, error: err.message };
        }
    });
    /**
     * Export Word (.docx) du même document, avec en-tête et pied de page
     * répétés sur chaque page via `html-to-docx`.
     */
    electron_1.ipcMain.handle('documents:exportDocumentDocx', async (_event, payload) => {
        try {
            const parsed = payloadSchema.safeParse(payload);
            if (!parsed.success) {
                return { success: false, error: parsed.error.issues.map((i) => i.message).join(', ') };
            }
            const session = (0, auth_service_1.getSession)(parsed.data.token);
            if (!session)
                return { success: false, error: 'Session expirée' };
            const { canceled, filePath } = await electron_1.dialog.showSaveDialog({
                defaultPath: `${parsed.data.fileName}.docx`,
                filters: [{ name: 'Word', extensions: ['docx'] }],
            });
            if (canceled || !filePath)
                return { success: true, data: { canceled: true } };
            const docx = await (0, docx_service_1.htmlToDocxWithTemplates)(parsed.data.bodyHtml, parsed.data.headerTemplate, parsed.data.footerTemplate, parsed.data.headerMm, parsed.data.footerMm);
            fs_1.default.writeFileSync(filePath, docx);
            electron_1.shell.showItemInFolder(filePath);
            logger_1.default.info(`Document Word exporté : ${filePath}`);
            return { success: true, data: { filePath, canceled: false } };
        }
        catch (err) {
            logger_1.default.error('documents:exportDocumentDocx', err.message);
            return { success: false, error: err.message };
        }
    });
}
