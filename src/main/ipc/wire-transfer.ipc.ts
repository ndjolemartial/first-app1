import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { getSettings, SettingsKeys } from '../services/settings.service';
import { resolveStoragePath } from '../services/storage.service';
import { htmlToPdf, openPrintPreview } from '../services/pdf.service';
import {
  renderWireTransferOrderHtml, buildWireTransferXlsx,
  DEFAULT_WIRE_TRANSFER_INTRO_HTML, DEFAULT_WIRE_TRANSFER_COLUMN_WIDTHS,
  type WireTransferBeneficiary, type WireTransferTemplateOpts,
} from '../services/wire-transfer.service';
import logger from '../utils/logger';

type Db = ReturnType<typeof getDb>;

// Génération de l'ordre de virement et édition de son modèle : réservées aux
// SEULS SUPER_ADMIN/ADMIN (rôle exact — checkRole ne fait pas d'équivalence
// pour cette liste, cf. career-profiles.ipc.ts).
const WIRE_TRANSFER_ROLES = ['SUPER_ADMIN', 'ADMIN'];

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];

// Marges gauche/droite légèrement plus larges que le défaut (0.4 in) pour
// aérer le tableau à 8 colonnes de la fiche.
const WIRE_TRANSFER_PDF_MARGINS = { left: 0.6, right: 0.6 };

/** S'assure qu'un modèle d'ordre de virement existe (création unique au premier appel). */
async function ensureWireTransferTemplate(db: Db) {
  const count = await db.wireTransferTemplate.count();
  if (count === 0) {
    await db.wireTransferTemplate.create({
      data: {
        name: 'Modèle par défaut',
        introHtml: DEFAULT_WIRE_TRANSFER_INTRO_HTML,
        columnWidths: DEFAULT_WIRE_TRANSFER_COLUMN_WIDTHS,
      },
    });
    logger.info('Wire transfer template seeded');
  }
  return db.wireTransferTemplate.findFirst({ orderBy: { id: 'asc' } });
}

/** Charge le logo de l'entreprise en data-URI (`data:image/...;base64,...`) ou `null`. */
async function loadCompanyLogo(): Promise<string | null> {
  try {
    const map = await getSettings([SettingsKeys.companyLogo]);
    const logoRel = map[SettingsKeys.companyLogo];
    if (!logoRel) return null;
    const abs = resolveStoragePath(logoRel);
    if (!fs.existsSync(abs)) return null;
    const buf = fs.readFileSync(abs);
    const ext = path.extname(logoRel).toLowerCase().replace('.', '') || 'png';
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
    return `data:${mime};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const periodSchema = z.object({
  periodYear: z.coerce.number().int().min(2000).max(2100),
  periodMonth: z.coerce.number().int().min(1).max(12),
});

/**
 * Charge les bulletins validés/payés de la période (hors brouillon et
 * annulés) et construit la liste des bénéficiaires (nom complet + références
 * bancaires + net à payer), triée par montant net à payer décroissant.
 */
async function loadBeneficiaries(db: Db, periodYear: number, periodMonth: number): Promise<WireTransferBeneficiary[]> {
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

function periodLabel(periodYear: number, periodMonth: number): string {
  return `${MONTHS_FR[periodMonth - 1]} ${periodYear}`;
}

function toTemplateOpts(t: any): WireTransferTemplateOpts {
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

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  introHtml: z.string().optional(),
  tableTitle: z.string().min(1).optional(),
  signatureLabel: z.string().min(1).optional(),
  signatureName: z.string().optional().nullable(),
  columnWidths: z.array(z.coerce.number().min(1).max(100)).length(8).optional(),
  accentColor: z.string().optional(),
  showLogo: z.boolean().optional(),
});

export function registerWireTransferIPC(): void {
  ipcMain.handle('wireTransfer:getTemplate', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WIRE_TRANSFER_ROLES);
      const db = getDb();
      const template = await ensureWireTransferTemplate(db);
      return ser({ success: true, data: template });
    } catch (error: any) {
      logger.error('wireTransfer:getTemplate error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('wireTransfer:updateTemplate', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WIRE_TRANSFER_ROLES);
      const parsed = updateTemplateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const template = await db.wireTransferTemplate.update({ where: { id }, data: parsed.data as any });
      logger.info(`Wire transfer template updated: id=${id}`);
      return ser({ success: true, data: template });
    } catch (error: any) {
      logger.error('wireTransfer:updateTemplate error', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Aperçu / impression : ouvre le PDF dans le visualiseur intégré (sans forcer l'enregistrement). */
  ipcMain.handle('wireTransfer:print', async (_event, { token, periodYear, periodMonth }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WIRE_TRANSFER_ROLES);
      const parsed = periodSchema.safeParse({ periodYear, periodMonth });
      if (!parsed.success) return { success: false, error: 'Période invalide' };
      const db = getDb();
      const beneficiaries = await loadBeneficiaries(db, parsed.data.periodYear, parsed.data.periodMonth);
      if (beneficiaries.length === 0) {
        return { success: false, error: 'Aucun bulletin validé ou payé pour cette période.' };
      }
      const template = await ensureWireTransferTemplate(db);
      const logo = template?.showLogo ? await loadCompanyLogo() : null;
      const label = periodLabel(parsed.data.periodYear, parsed.data.periodMonth);
      const html = renderWireTransferOrderHtml(beneficiaries, label, logo, toTemplateOpts(template));
      const pdf = await htmlToPdf(html, { landscape: true, margins: WIRE_TRANSFER_PDF_MARGINS });
      await openPrintPreview(pdf, `Ordre de virement — ${label}`);
      return { success: true, data: { previewing: true } };
    } catch (error: any) {
      logger.error('wireTransfer:print error', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Export PDF : enregistrement direct sur disque (boîte de dialogue). */
  ipcMain.handle('wireTransfer:exportPdf', async (_event, { token, periodYear, periodMonth }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WIRE_TRANSFER_ROLES);
      const parsed = periodSchema.safeParse({ periodYear, periodMonth });
      if (!parsed.success) return { success: false, error: 'Période invalide' };
      const db = getDb();
      const beneficiaries = await loadBeneficiaries(db, parsed.data.periodYear, parsed.data.periodMonth);
      if (beneficiaries.length === 0) {
        return { success: false, error: 'Aucun bulletin validé ou payé pour cette période.' };
      }
      const template = await ensureWireTransferTemplate(db);
      const logo = template?.showLogo ? await loadCompanyLogo() : null;
      const label = periodLabel(parsed.data.periodYear, parsed.data.periodMonth);
      const html = renderWireTransferOrderHtml(beneficiaries, label, logo, toTemplateOpts(template));
      const pdf = await htmlToPdf(html, { landscape: true, margins: WIRE_TRANSFER_PDF_MARGINS });

      const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
      const fileName = `ordre-virement-${parsed.data.periodYear}-${String(parsed.data.periodMonth).padStart(2, '0')}`;
      const result = await dialog.showSaveDialog(parent!, {
        title: 'Exporter l\'ordre de virement (PDF)',
        defaultPath: path.join(app.getPath('documents'), `${fileName}.pdf`),
        filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: { canceled: true } };
      fs.writeFileSync(result.filePath, pdf);
      logger.info(`Ordre de virement PDF exporté: ${result.filePath} (${beneficiaries.length} bénéficiaires)`);
      return { success: true, data: { path: result.filePath } };
    } catch (error: any) {
      logger.error('wireTransfer:exportPdf error', error.message);
      return { success: false, error: error.message };
    }
  });

  /** Export Excel : enregistrement direct sur disque (boîte de dialogue). */
  ipcMain.handle('wireTransfer:exportExcel', async (_event, { token, periodYear, periodMonth }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WIRE_TRANSFER_ROLES);
      const parsed = periodSchema.safeParse({ periodYear, periodMonth });
      if (!parsed.success) return { success: false, error: 'Période invalide' };
      const db = getDb();
      const beneficiaries = await loadBeneficiaries(db, parsed.data.periodYear, parsed.data.periodMonth);
      if (beneficiaries.length === 0) {
        return { success: false, error: 'Aucun bulletin validé ou payé pour cette période.' };
      }
      const template = await ensureWireTransferTemplate(db);
      const logo = template?.showLogo ? await loadCompanyLogo() : null;
      const label = periodLabel(parsed.data.periodYear, parsed.data.periodMonth);
      const xlsx = await buildWireTransferXlsx(beneficiaries, label, toTemplateOpts(template), logo);

      const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
      const fileName = `ordre-virement-${parsed.data.periodYear}-${String(parsed.data.periodMonth).padStart(2, '0')}`;
      const result = await dialog.showSaveDialog(parent!, {
        title: 'Exporter l\'ordre de virement (Excel)',
        defaultPath: path.join(app.getPath('documents'), `${fileName}.xlsx`),
        filters: [{ name: 'Classeur Excel', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: { canceled: true } };
      fs.writeFileSync(result.filePath, xlsx);
      logger.info(`Ordre de virement Excel exporté: ${result.filePath} (${beneficiaries.length} bénéficiaires)`);
      return { success: true, data: { path: result.filePath } };
    } catch (error: any) {
      logger.error('wireTransfer:exportExcel error', error.message);
      return { success: false, error: error.message };
    }
  });
}
