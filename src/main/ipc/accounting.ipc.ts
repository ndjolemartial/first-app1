import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import path from 'path';
import fs from 'fs';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import { htmlToPdf } from '../services/pdf.service';
import { resolveInvoiceTemplate } from './invoice-templates.ipc';
import { recordTreasuryOperation } from '../services/treasury.service';
import logger from '../utils/logger';
import { z } from 'zod';

// Module Comptabilité : réservé aux MANAGER+ (ACCOUNTANT inclus via checkRole).
// AGENT et READONLY n'ont aucun accès au module ; ASSISTANTE_DIRECTION non plus
// (exception à l'équivalence MANAGER, voir checkAccountingRole ci-dessous).
const READ_ROLES  = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];

/**
 * Vérifie le rôle pour l'accès au module Comptabilité.
 *
 * Exception à l'équivalence ACCOUNTANT/MANAGER : ASSISTANTE_DIRECTION, qui
 * hérite normalement des permissions MANAGER, n'a pas accès au module
 * Comptabilité (décision produit).
 */
function checkAccountingRole(session: { role: string }, allowedRoles: string[]): void {
  if (session.role === 'ASSISTANTE_DIRECTION') {
    throw new Error('Permission insuffisante');
  }
  checkRole(session as any, allowedRoles);
}

/** Sérialise pour l'IPC : les Decimal Prisma ne sont pas clonables par Electron. */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/**
 * Synchronise les rappels CRM (type RAPPEL) rattachés à une facture en
 * fonction du nouveau statut de cette dernière. Utilisé partout où une
 * facture change de statut (paiement, annulation, réintégration).
 *
 * - PAYEE                                  → activités EN_ATTENTE → TRAITE
 * - ANNULEE                                → activités EN_ATTENTE → ANNULE
 * - BROUILLON / ENVOYEE / EN_RETARD / PARTIEL → activités ANNULE/TRAITE → EN_ATTENTE
 */
async function syncInvoiceActivities(
  db: ReturnType<typeof getDb>,
  invoiceId: number,
  newStatus: string,
): Promise<void> {
  if (newStatus === 'PAYEE') {
    await db.crmActivity.updateMany({
      where: { invoiceId, status: 'EN_ATTENTE' },
      data: { status: 'TRAITE', completedAt: new Date() },
    });
  } else if (newStatus === 'ANNULEE') {
    await db.crmActivity.updateMany({
      where: { invoiceId, status: 'EN_ATTENTE' },
      data: { status: 'ANNULE' },
    });
  } else {
    // Réactivation : seuls les rappels effectivement clos sont remis en attente.
    await db.crmActivity.updateMany({
      where: { invoiceId, status: { in: ['ANNULE', 'TRAITE'] } },
      data: { status: 'EN_ATTENTE', completedAt: null },
    });
  }
}

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
});

const invoiceSchema = z.object({
  type: z.enum(['VENTE', 'ECHEANCE_VENTE', 'FRAIS_AGENCE', 'FRAIS_DE_GESTION', 'FRAIS_DEMARCHES_ACD', 'AVANCE', 'CAUTION', 'OTHER']),
  clientId: z.number().int().optional(),
  conventionId: z.number().int().optional(),
  taxRate: z.number().min(0).max(100).default(0),
  issueDate: z.string().datetime().optional(),
  dueDate: z.string().datetime(),
  notes: z.string().optional(),
  items: z.array(invoiceItemSchema).min(1),
});

const paymentSchema = z.object({
  invoiceId: z.number().int().positive(),
  amount: z.number().positive(),
  method: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY']),
  reference: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().datetime().optional(),
  // Trésorerie : compte encaissé et objet d'opération (facultatifs).
  bankAccountId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
});

const installmentPaymentSchema = z.object({
  installmentId: z.number().int().positive(),
  method: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY']),
  paymentRef: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().datetime().optional(),
  // Trésorerie : compte encaissé et objet d'opération (facultatifs).
  bankAccountId: z.number().int().positive().optional(),
  categoryId: z.number().int().positive().optional(),
});

/** Génère une référence de facture : FAC-YYYY-NNNN */
async function nextInvoiceRef(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.invoice.findFirst({
    where: { reference: { startsWith: `FAC-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `FAC-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Calcule le chiffre d'affaires encaissé sur une période [start, end[ :
 * somme des paiements reçus + factures soldées (PAYEE) sans paiement détaillé.
 */
async function computeRevenue(
  db: ReturnType<typeof getDb>,
  start: Date,
  end: Date,
): Promise<{ revenue: number; count: number }> {
  const [paymentsAgg, directAgg] = await Promise.all([
    db.payment.aggregate({
      where: { paidAt: { gte: start, lt: end }, invoice: { deletedAt: null } },
      _sum: { amount: true },
      _count: true,
    }),
    db.invoice.aggregate({
      where: {
        deletedAt: null,
        status: 'PAYEE',
        paidAt: { gte: start, lt: end },
        payments: { none: {} },
      },
      _sum: { total: true },
      _count: true,
    }),
  ]);
  return {
    revenue: Number(paymentsAgg._sum.amount ?? 0) + Number(directAgg._sum.total ?? 0),
    count: paymentsAgg._count + directAgg._count,
  };
}

const INVOICE_TYPE_LABEL: Record<string, string> = {
  VENTE: 'Vente', ECHEANCE_VENTE: 'Échéance de vente', FRAIS_AGENCE: "Frais d'agence",
  FRAIS_DE_GESTION: 'Frais de gestion', FRAIS_DEMARCHES_ACD: 'Frais de démarches ACD',
  AVANCE: 'Avance', CAUTION: 'Caution', OTHER: 'Autre',
};
const INVOICE_STATUS_LABEL: Record<string, string> = {
  BROUILLON: 'Brouillon', ENVOYEE: 'Validée', PAYEE: 'Payée',
  PARTIEL: 'Partiellement payée', EN_RETARD: 'En retard', ANNULEE: 'Annulée',
};

/**
 * Construit le document HTML imprimable d'une facture (format A4 portrait).
 */
/** CSS spécifique à chaque mise en page de facture. */
function invoiceLayoutCss(layout: string, accent: string): string {
  if (layout === 'MODERNE') {
    return `
  body { border-top: 6px solid ${accent}; padding-top: 14px; }
  .head { padding-bottom: 12px; }
  .badge { background: ${accent}; color: #fff; }
  table.items thead th { background: transparent; color: ${accent}; border-bottom: 2px solid ${accent}; }
  table.items td { border-bottom: 1px solid #eef2f7; }
  table.items tbody tr:nth-child(even) td { background: #f8fafc; }
  .totals .grand { border-top: 2px solid ${accent}; }`;
  }
  if (layout === 'COMPACT') {
    return `
  body { font-size: 10px; }
  .head { border-bottom: 1px solid ${accent}; padding-bottom: 6px; }
  .doc h1 { font-size: 16px; }
  .badge { background: #e2e8f0; color: #334155; }
  .parties { margin-top: 12px; }
  .meta { margin-top: 10px; gap: 16px; }
  table.items { margin-top: 10px; }
  table.items thead th { background: ${accent}; color: #fff; }
  table.items td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; }
  .totals .grand { border-top: 1px solid ${accent}; }`;
  }
  // CLASSIQUE
  return `
  .head { border-bottom: 3px solid ${accent}; padding-bottom: 12px; }
  .badge { background: #e2e8f0; color: ${accent}; }
  table.items thead th { background: ${accent}; color: #fff; }
  table.items td { border-bottom: 1px solid #e2e8f0; }
  .totals .grand { border-top: 2px solid ${accent}; }`;
}

/**
 * Construit le document HTML imprimable d'une facture (A4 portrait), selon le
 * modèle fourni : mise en page, couleur d'accent, en-tête et pied éditables.
 */
function buildInvoiceHtml(inv: any, tpl: any): string {
  const esc = (v: unknown) =>
    String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = (n: unknown) =>
    `${new Intl.NumberFormat('fr-FR').format(Math.round(Number(n ?? 0)))} FCFA`;
  const fmtDate = (d: unknown) => (d ? new Date(d as any).toLocaleDateString('fr-FR') : '—');

  const accent = (tpl?.accentColor as string) || '#1E3A5F';
  const layout = (tpl?.layout as string) || 'CLASSIQUE';
  const headerHtml = (tpl?.headerHtml as string) || '<p><strong style="font-size:18px">AFRIKIMMO</strong></p>';
  const footerHtml = (tpl?.footerHtml as string) || '';

  const c = inv.client;
  const clientName = c
    ? (c.type === 'INDIVIDUEL' ? `${c.lastName ?? ''} ${c.firstName ?? ''}`.trim() : (c.entreprise ?? ''))
    : '—';
  const clientLines: string[] = c
    ? [c.address, [c.postalCode, c.city].filter(Boolean).join(' '), c.country, c.phone, c.email].filter(Boolean)
    : [];
  const totalPaid = (inv.payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const balance = Number(inv.total) - totalPaid;

  const itemsRows = (inv.items ?? [])
    .map((it: any) => `<tr><td>${esc(it.description)}</td><td class="num">${Number(it.quantity)}</td><td class="num">${fmt(it.unitPrice)}</td><td class="num">${fmt(it.total)}</td></tr>`)
    .join('');
  const paymentsRows = (inv.payments ?? [])
    .map((p: any) => `<tr><td>${fmtDate(p.paidAt)}</td><td>${esc(p.method)}</td><td>${esc(p.reference ?? '—')}</td><td class="num">${fmt(p.amount)}</td></tr>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 0; font-size: 12px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .head .brand p { margin: 0; }
  .doc { text-align: right; }
  .doc h1 { font-size: 20px; color: ${accent}; margin: 0; }
  .doc .ref { font-size: 13px; color: #475569; margin-top: 2px; }
  .badge { display: inline-block; margin-top: 6px; padding: 2px 10px; border-radius: 4px; font-size: 11px; font-weight: bold; }
  .parties { display: flex; justify-content: space-between; margin-top: 20px; gap: 24px; }
  .parties h3 { font-size: 10px; text-transform: uppercase; color: #94a3b8; margin: 0 0 4px; }
  .parties .name { font-weight: bold; font-size: 13px; }
  .meta { margin-top: 18px; display: flex; gap: 28px; font-size: 11px; }
  .meta span { color: #94a3b8; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 16px; }
  table.items th { text-align: left; padding: 6px 8px; font-size: 11px; }
  table.items td { padding: 6px 8px; }
  table.items .num { text-align: right; }
  .totals { margin-top: 12px; margin-left: auto; width: 270px; font-size: 12px; }
  .totals div { display: flex; justify-content: space-between; padding: 3px 0; }
  .totals .grand { font-weight: bold; font-size: 14px; color: ${accent}; padding-top: 6px; margin-top: 2px; }
  .sec { margin-top: 24px; font-size: 10px; text-transform: uppercase; color: #94a3b8; }
  .foot { margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 10px; font-size: 11px; color: #475569; }
  ${invoiceLayoutCss(layout, accent)}
</style></head><body>
  <div class="head">
    <div class="brand">${headerHtml}</div>
    <div class="doc">
      <h1>FACTURE</h1>
      <div class="ref">${esc(inv.reference)}</div>
      <div class="badge">${esc(INVOICE_STATUS_LABEL[inv.status] ?? inv.status)}</div>
    </div>
  </div>
  <div class="parties">
    <div><h3>Émetteur</h3><div class="name">AFRIKIMMO</div></div>
    <div style="text-align:right;">
      <h3>Facturé à</h3>
      <div class="name">${esc(clientName)}</div>
      ${clientLines.map((l) => `<div>${esc(l)}</div>`).join('')}
    </div>
  </div>
  <div class="meta">
    <div><span>Type</span><br>${esc(INVOICE_TYPE_LABEL[inv.type] ?? inv.type)}</div>
    <div><span>Date d'émission</span><br>${fmtDate(inv.issueDate)}</div>
    <div><span>Date d'échéance</span><br>${fmtDate(inv.dueDate)}</div>
    ${inv.convention ? `<div><span>Convention</span><br>${esc(inv.convention.reference)}</div>` : ''}
  </div>
  <table class="items">
    <thead><tr><th>Description</th><th class="num">Qté</th><th class="num">Prix unitaire</th><th class="num">Total</th></tr></thead>
    <tbody>${itemsRows || '<tr><td colspan="4">Aucune ligne</td></tr>'}</tbody>
  </table>
  <div class="totals">
    <div><span>Sous-total HT</span><span>${fmt(inv.subtotal)}</span></div>
    <div><span>TVA (${Number(inv.taxRate)} %)</span><span>${fmt(inv.taxAmount)}</span></div>
    <div class="grand"><span>Total TTC</span><span>${fmt(inv.total)}</span></div>
  </div>
  ${(inv.payments ?? []).length > 0 ? `
  <div class="sec">Règlements</div>
  <table class="items">
    <thead><tr><th>Date</th><th>Mode</th><th>Référence</th><th class="num">Montant</th></tr></thead>
    <tbody>${paymentsRows}</tbody>
  </table>
  <div class="totals">
    <div><span>Total encaissé</span><span>${fmt(totalPaid)}</span></div>
    <div class="grand"><span>Reste à payer</span><span>${fmt(balance)}</span></div>
  </div>` : ''}
  ${inv.installmentRecap ? `
  <div class="sec">Échéancier de la convention</div>
  <div class="totals">
    <div><span>Échéances réglées</span><span>${inv.installmentRecap.paidCount} / ${inv.installmentRecap.totalCount} — ${fmt(inv.installmentRecap.paidAmount)}</span></div>
    <div class="grand"><span>Solde des échéances restantes (${inv.installmentRecap.remainingCount})</span><span>${fmt(inv.installmentRecap.remainingAmount)}</span></div>
  </div>` : ''}
  ${footerHtml ? `<div class="foot">${footerHtml}</div>` : ''}
  <div style="margin-top:14px;font-size:9px;color:#94a3b8;text-align:center;">Document généré le ${new Date().toLocaleString('fr-FR')} — Afrikimmo-App</div>
</body></html>`;
}

/**
 * Enregistre les handlers IPC pour la comptabilité.
 */
export function registerAccountingIPC(): void {

  /* ─── Tableau de bord financier ─────────────────────────────────── */

  ipcMain.handle('accounting:getDashboard', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const now = new Date();

      // Promeut les échéances échues encore marquées en attente.
      await db.saleInstallment.updateMany({
        where: { status: { in: ['EN_ATTENTE', 'A_REGLER'] }, dueDate: { lt: now } },
        data: { status: 'EN_RETARD' },
      });

      const [
        paidInvoicesAgg,
        overdueAgg,
        unpaidInstallmentsAgg,
        upcomingInstallments,
        overdueInstallments,
        recentInvoices,
        unpaidFull,
        partialInvoices,
        partialPayments,
      ] = await Promise.all([
        db.invoice.aggregate({ where: { deletedAt: null, status: 'PAYEE' }, _count: true, _sum: { total: true } }),
        db.saleInstallment.aggregate({ where: { status: 'EN_RETARD' }, _count: true, _sum: { amount: true } }),
        db.saleInstallment.aggregate({
          where: { status: { in: ['EN_ATTENTE', 'A_REGLER', 'EN_RETARD'] } },
          _count: true,
          _sum: { amount: true },
        }),
        db.saleInstallment.findMany({
          where: { status: { in: ['EN_ATTENTE', 'A_REGLER'] }, dueDate: { gte: now } },
          orderBy: { dueDate: 'asc' },
          take: 8,
          include: {
            convention: {
              select: {
                id: true,
                reference: true,
                client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
              },
            },
          },
        }),
        db.saleInstallment.findMany({
          where: { status: 'EN_RETARD' },
          orderBy: { dueDate: 'asc' },
          take: 10,
          include: {
            convention: {
              select: {
                id: true,
                reference: true,
                client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
              },
            },
          },
        }),
        db.invoice.findMany({
          where: { deletedAt: null },
          orderBy: { issueDate: 'desc' },
          take: 10,
          include: {
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            convention: { select: { id: true, reference: true } },
          },
        }),
        db.invoice.aggregate({
          where: { deletedAt: null, status: { in: ['ENVOYEE', 'EN_RETARD'] } },
          _sum: { total: true },
          _count: true,
        }),
        db.invoice.aggregate({
          where: { deletedAt: null, status: 'PARTIEL' },
          _sum: { total: true },
          _count: true,
        }),
        db.payment.aggregate({
          where: { invoice: { deletedAt: null, status: 'PARTIEL' } },
          _sum: { amount: true },
        }),
      ]);

      // Impayés : total des factures ENVOYEE / EN_RETARD + solde restant des PARTIEL.
      const unpaidAmount =
        Number(unpaidFull._sum.total ?? 0) +
        Number(partialInvoices._sum.total ?? 0) -
        Number(partialPayments._sum.amount ?? 0);
      const unpaidCount = unpaidFull._count + partialInvoices._count;

      // CA encaissé des 6 derniers mois (graphique).
      const revenueChart: { month: string; revenue: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
        const { revenue } = await computeRevenue(db, start, end);
        revenueChart.push({ month: String(d.getMonth() + 1).padStart(2, '0'), revenue });
      }

      return ser({
        success: true,
        data: {
          paidInvoicesCount: paidInvoicesAgg._count,
          paidInvoicesAmount: Number(paidInvoicesAgg._sum.total ?? 0),
          unpaidCount,
          unpaidAmount,
          unpaidInstallmentsCount: unpaidInstallmentsAgg._count,
          unpaidInstallmentsAmount: Number(unpaidInstallmentsAgg._sum.amount ?? 0),
          overdueInstallmentsCount: overdueAgg._count,
          overdueInstallmentsAmount: Number(overdueAgg._sum.amount ?? 0),
          revenueChart,
          upcomingInstallments,
          overdueInstallments,
          recentInvoices,
        },
      });
    } catch (error: any) {
      logger.error('accounting:getDashboard error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Chiffre d'affaires par période ─────────────────────────────── */

  ipcMain.handle('accounting:getRevenue', async (_event, { token, period = 'month' }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();

      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth();
      const MOIS = [
        'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
      ];
      let start: Date;
      let end: Date;
      let label: string;
      if (period === 'quarter') {
        const q = Math.floor(m / 3);
        start = new Date(y, q * 3, 1);
        end = new Date(y, q * 3 + 3, 1);
        label = `${q === 0 ? '1er' : `${q + 1}e`} trimestre ${y}`;
      } else if (period === 'semester') {
        const s = m < 6 ? 0 : 1;
        start = new Date(y, s * 6, 1);
        end = new Date(y, s * 6 + 6, 1);
        label = `${s === 0 ? '1er' : '2e'} semestre ${y}`;
      } else if (period === 'year') {
        start = new Date(y, 0, 1);
        end = new Date(y + 1, 0, 1);
        label = `Année ${y}`;
      } else {
        start = new Date(y, m, 1);
        end = new Date(y, m + 1, 1);
        label = `${MOIS[m]} ${y}`;
      }

      // CA = encaissements de la période (paiements, y compris partiels).
      const { revenue, count } = await computeRevenue(db, start, end);

      // Détail par type de facture (utilisé dans l'infobulle au survol).
      const [paymentsByType, directByType] = await Promise.all([
        db.payment.findMany({
          where: { paidAt: { gte: start, lt: end }, invoice: { deletedAt: null } },
          select: { amount: true, invoice: { select: { type: true } } },
        }),
        db.invoice.findMany({
          where: {
            deletedAt: null,
            status: 'PAYEE',
            paidAt: { gte: start, lt: end },
            payments: { none: {} },
          },
          select: { total: true, type: true },
        }),
      ]);
      const byType: Record<string, number> = {};
      for (const p of paymentsByType) {
        const t = p.invoice?.type ?? 'OTHER';
        byType[t] = (byType[t] ?? 0) + Number(p.amount);
      }
      for (const inv of directByType) {
        byType[inv.type] = (byType[inv.type] ?? 0) + Number(inv.total);
      }

      return { success: true, data: { revenue, count, label, byType } };
    } catch (error: any) {
      logger.error('accounting:getRevenue error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Factures ───────────────────────────────────────────────────── */

  ipcMain.handle('accounting:getInvoices', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.unpaid) where.status = { in: ['ENVOYEE', 'EN_RETARD', 'PARTIEL'] };
      else if (filters.status) where.status = filters.status;
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.conventionId) where.conventionId = filters.conventionId;
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { notes: { contains: filters.search } },
          { client: { firstName: { contains: filters.search } } },
          { client: { lastName: { contains: filters.search } } },
          { client: { entreprise: { contains: filters.search } } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.invoice.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { issueDate: 'desc' },
          include: {
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            convention: { select: { id: true, reference: true, type: true } },
            payments: { select: { amount: true } },
            _count: { select: { payments: true } },
          },
        }),
        db.invoice.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('accounting:getInvoices error', error.message);
      return { success: false, error: error.message };
    }
  });

  // Récapitulatif du nombre de factures par type, en respectant les autres
  // filtres actifs (status, search, clientId, conventionId). Le filtre `type`
  // est volontairement ignoré ici : les compteurs doivent rester comparables.
  ipcMain.handle('accounting:getInvoiceTypeStats', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.unpaid) where.status = { in: ['ENVOYEE', 'EN_RETARD', 'PARTIEL'] };
      else if (filters.status) where.status = filters.status;
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.conventionId) where.conventionId = filters.conventionId;
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { notes: { contains: filters.search } },
          { client: { firstName: { contains: filters.search } } },
          { client: { lastName: { contains: filters.search } } },
          { client: { entreprise: { contains: filters.search } } },
        ];
      }
      const rows = await db.invoice.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      });
      const stats: Record<string, number> = {
        VENTE: 0, ECHEANCE_VENTE: 0, FRAIS_AGENCE: 0, FRAIS_DE_GESTION: 0,
        FRAIS_DEMARCHES_ACD: 0, AVANCE: 0, CAUTION: 0, OTHER: 0,
      };
      let total = 0;
      for (const r of rows) {
        const n = r._count?._all ?? 0;
        stats[r.type as string] = n;
        total += n;
      }
      return { success: true, data: { ...stats, total } };
    } catch (error: any) {
      logger.error('accounting:getInvoiceTypeStats error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getInvoiceById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const invoice = await db.invoice.findUnique({
        where: { id, deletedAt: null },
        include: {
          client: true,
          convention: {
            include: {
              properties: {
                orderBy: { order: 'asc' },
                include: { property: { select: { id: true, reference: true, address: true, city: true } } },
              },
              terrains: {
                orderBy: { order: 'asc' },
                include: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
              },
            },
          },
          // Rattachement direct au terrain (factures de frais de démarches ACD).
          terrain: {
            select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true,
              lotissement: { select: { id: true, reference: true, nom: true } } },
          },
          items: true,
          payments: { orderBy: { paidAt: 'desc' } },
          documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' } },
        },
      });
      if (!invoice) return { success: false, error: 'Facture introuvable' };
      return ser({ success: true, data: invoice });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:createInvoice', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, WRITE_ROLES);
      const parsed = invoiceSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextInvoiceRef(db);
      const d = parsed.data;
      // Les montants sont calculés côté serveur à partir des lignes de facturation.
      const round2 = (n: number) => Math.round(n * 100) / 100;
      const items = d.items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: round2(item.quantity * item.unitPrice),
      }));
      const subtotal = round2(items.reduce((sum, it) => sum + it.total, 0));
      const taxAmount = round2((subtotal * d.taxRate) / 100);
      const total = round2(subtotal + taxAmount);
      const invoice = await db.invoice.create({
        data: {
          reference,
          type: d.type,
          status: 'BROUILLON' as any,
          clientId: d.clientId,
          conventionId: d.conventionId,
          subtotal: subtotal as any,
          taxRate: d.taxRate as any,
          taxAmount: taxAmount as any,
          total: total as any,
          issueDate: d.issueDate ? new Date(d.issueDate) : new Date(),
          dueDate: new Date(d.dueDate),
          notes: d.notes,
          items: {
            create: items.map((it) => ({
              description: it.description,
              quantity: it.quantity as any,
              unitPrice: it.unitPrice as any,
              total: it.total as any,
            })),
          },
        },
        include: { items: true },
      });
      logger.info(`Invoice created: ${invoice.reference}`);
      return ser({ success: true, data: invoice });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:updateInvoiceStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, WRITE_ROLES);
      const db = getDb();
      const invoice = await db.invoice.update({
        where: { id, deletedAt: null },
        data: { status, ...(status === 'PAYEE' && { paidAt: new Date() }) },
        select: { id: true, status: true, reference: true },
      });
      await syncInvoiceActivities(db, id, status);
      return ser({ success: true, data: invoice });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Réintègre une facture annulée. Le statut cible est calculé en fonction
  // des paiements et de la date d'échéance, pour préserver la cohérence :
  //   - payée intégralement      → PAYEE (paidAt restauré)
  //   - paiement partiel         → PARTIEL
  //   - aucun paiement, échue    → EN_RETARD
  //   - aucun paiement, à venir  → BROUILLON
  ipcMain.handle('accounting:reinstateInvoice', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, WRITE_ROLES);
      const db = getDb();
      const invoice = await db.invoice.findUnique({
        where: { id, deletedAt: null },
        include: { payments: { select: { amount: true, paidAt: true } } },
      });
      if (!invoice) return { success: false, error: 'Facture introuvable' };
      if (invoice.status !== 'ANNULEE') {
        return { success: false, error: "Seule une facture annulée peut être réintégrée." };
      }
      const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0);
      const total = Number(invoice.total);
      let nextStatus: 'PAYEE' | 'PARTIEL' | 'EN_RETARD' | 'BROUILLON';
      let nextPaidAt: Date | null = null;
      if (totalPaid >= total && total > 0) {
        nextStatus = 'PAYEE';
        // paidAt = dernière date de règlement
        const latest = invoice.payments
          .map((p) => p.paidAt)
          .sort((a, b) => b.getTime() - a.getTime())[0];
        nextPaidAt = latest ?? new Date();
      } else if (totalPaid > 0) {
        nextStatus = 'PARTIEL';
      } else if (new Date(invoice.dueDate).getTime() < Date.now()) {
        nextStatus = 'EN_RETARD';
      } else {
        nextStatus = 'BROUILLON';
      }
      const updated = await db.invoice.update({
        where: { id },
        data: {
          status: nextStatus,
          paidAt: nextStatus === 'PAYEE' ? nextPaidAt : null,
        },
        select: { id: true, status: true, reference: true },
      });
      await syncInvoiceActivities(db, id, updated.status);
      logger.info(`Facture réintégrée: ${updated.reference} → ${updated.status}`);
      return ser({ success: true, data: updated });
    } catch (error: any) {
      logger.error('accounting:reinstateInvoice error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:addPayment', async (_event, { token, invoiceId, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, WRITE_ROLES);
      const parsed = paymentSchema.safeParse({ invoiceId, ...payload });
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;

      const invoice = await db.invoice.findUnique({
        where: { id: d.invoiceId },
        include: { payments: true },
      });
      if (!invoice) return { success: false, error: 'Facture introuvable' };

      const paidAt = d.paidAt ? new Date(d.paidAt) : new Date();

      // Vérifie le compte de trésorerie si l'encaissement y est rattaché.
      if (d.bankAccountId) {
        const account = await db.bankAccount.findUnique({ where: { id: d.bankAccountId } });
        if (!account || account.deletedAt) return { success: false, error: 'Compte de trésorerie introuvable' };
      }

      // Recalcule le total payé et le statut résultant de la facture.
      const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + d.amount;
      const invoiceTotal = Number(invoice.total);
      let newStatus: string;
      if (totalPaid >= invoiceTotal) newStatus = 'PAYEE';
      else if (totalPaid > 0) newStatus = 'PARTIEL';
      else newStatus = invoice.status;

      const payment = await db.$transaction(async (tx) => {
        const created = await tx.payment.create({
          data: {
            invoiceId: d.invoiceId,
            amount: d.amount as any,
            method: d.method,
            paidAt,
            reference: d.reference,
            notes: d.notes,
            bankAccountId: d.bankAccountId ?? null,
          },
        });
        await tx.invoice.update({
          where: { id: d.invoiceId },
          data: {
            status: newStatus as any,
            ...(newStatus === 'PAYEE' && { paidAt: new Date() }),
          },
        });
        // Encaissement rattaché à un compte → mouvement de trésorerie (entrée).
        if (d.bankAccountId) {
          await recordTreasuryOperation(tx, {
            bankAccountId: d.bankAccountId,
            direction: 'ENTREE',
            amount: d.amount,
            label: `Encaissement facture ${invoice.reference}`,
            operationDate: paidAt,
            categoryId: d.categoryId ?? null,
            paymentMethod: d.method,
            paymentRef: d.reference,
            source: 'FACTURE',
            paymentId: created.id,
            createdById: session.userId,
          });
        }
        return created;
      });

      // Synchronise les rappels CRM liés à la facture (TRAITE si PAYEE).
      // Statut PARTIEL : on laisse les rappels actifs (échéance non soldée).
      if (newStatus === 'PAYEE') {
        await syncInvoiceActivities(db, d.invoiceId, 'PAYEE');
      }

      logger.info(`Payment recorded: invoice=${d.invoiceId} amount=${d.amount}`);
      return ser({ success: true, data: payment });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /* ─── Impression d'une facture en PDF ────────────────────────────── */

  ipcMain.handle('accounting:printInvoice', async (_event, { token, invoiceId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const invoice = await db.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          client: true,
          convention: { select: { id: true, reference: true } },
          items: true,
          payments: { orderBy: { paidAt: 'asc' } },
        },
      });
      if (!invoice || invoice.deletedAt) return { success: false, error: 'Facture introuvable' };

      // Pour une facture d'échéance, joint le solde des échéances restantes de la convention.
      let installmentRecap: any = null;
      if (invoice.type === 'ECHEANCE_VENTE' && invoice.conventionId) {
        const insts = await db.saleInstallment.findMany({ where: { conventionId: invoice.conventionId } });
        const active = insts.filter((i) => i.status !== 'ANNULE');
        if (active.length > 0) {
          const paid = active.filter((i) => i.status === 'PAYE');
          const remaining = active.filter((i) => i.status !== 'PAYE');
          installmentRecap = {
            totalCount: active.length,
            paidCount: paid.length,
            paidAmount: paid.reduce((s, i) => s + Number(i.amount), 0),
            remainingCount: remaining.length,
            remainingAmount: remaining.reduce((s, i) => s + Number(i.amount), 0),
          };
        }
      }

      const template = await resolveInvoiceTemplate(db, invoice.type);
      const pdf = await htmlToPdf(buildInvoiceHtml({ ...invoice, installmentRecap }, template), { landscape: false });
      const parent = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? undefined;
      const result = await dialog.showSaveDialog(parent!, {
        title: 'Enregistrer la facture',
        defaultPath: path.join(app.getPath('documents'), `Facture-${invoice.reference}.pdf`),
        filters: [{ name: 'Document PDF', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) {
        return { success: true, data: { canceled: true } };
      }
      fs.writeFileSync(result.filePath, pdf);
      logger.info(`Invoice PDF generated: ${invoice.reference} → ${result.filePath}`);
      return { success: true, data: { path: result.filePath } };
    } catch (error: any) {
      logger.error('accounting:printInvoice error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Échéances de vente ─────────────────────────────────────────── */

  ipcMain.handle('accounting:getOverdueInstallments', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();

      // Met à jour les statuts EN_ATTENTE qui sont maintenant dépassées
      await db.saleInstallment.updateMany({
        where: {
          status: { in: ['EN_ATTENTE', 'A_REGLER'] },
          dueDate: { lt: new Date() },
        },
        data: { status: 'EN_RETARD' },
      });

      const data = await db.saleInstallment.findMany({
        where: { status: 'EN_RETARD' },
        orderBy: { dueDate: 'asc' },
        include: {
          convention: {
            select: {
              id: true,
              reference: true,
              assetType: true,
              client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
              properties: {
                orderBy: { order: 'asc' },
                select: { property: { select: { id: true, reference: true, address: true, city: true } } },
              },
              terrains: {
                orderBy: { order: 'asc' },
                select: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
              },
            },
          },
        },
      });
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // Toutes les échéances impayées (en attente + à régler + en retard).
  // Auto-promeut les échues encore en attente vers EN_RETARD avant lecture.
  ipcMain.handle('accounting:getUnpaidInstallments', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();

      await db.saleInstallment.updateMany({
        where: {
          status: { in: ['EN_ATTENTE', 'A_REGLER'] },
          dueDate: { lt: new Date() },
        },
        data: { status: 'EN_RETARD' },
      });

      const data = await db.saleInstallment.findMany({
        where: { status: { in: ['EN_ATTENTE', 'A_REGLER', 'EN_RETARD'] } },
        orderBy: { dueDate: 'asc' },
        include: {
          convention: {
            select: {
              id: true,
              reference: true,
              assetType: true,
              client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
              properties: {
                orderBy: { order: 'asc' },
                select: { property: { select: { id: true, reference: true, address: true, city: true } } },
              },
              terrains: {
                orderBy: { order: 'asc' },
                select: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
              },
            },
          },
        },
      });
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getUpcomingInstallments', async (_event, { token, days = 30 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const where: any = {
        status: { in: ['EN_ATTENTE', 'A_REGLER'] },
        dueDate: { gte: new Date() },
      };
      // days <= 0 → toutes les échéances à venir (aucune borne supérieure).
      if (days > 0) {
        where.dueDate.lte = new Date(Date.now() + days * 24 * 3600 * 1000);
      }
      const data = await db.saleInstallment.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        include: {
          convention: {
            select: {
              id: true,
              reference: true,
              assetType: true,
              client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
              properties: {
                orderBy: { order: 'asc' },
                select: { property: { select: { id: true, reference: true, address: true, city: true } } },
              },
              terrains: {
                orderBy: { order: 'asc' },
                select: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
              },
            },
          },
        },
      });
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:listInstallments', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const data = await db.saleInstallment.findMany({
        orderBy: [{ conventionId: 'asc' }, { installmentNumber: 'asc' }],
        select: {
          id: true,
          installmentNumber: true,
          dueDate: true,
          amount: true,
          status: true,
          convention: {
            select: {
              id: true,
              reference: true,
              client: { select: { firstName: true, lastName: true, entreprise: true, type: true } },
            },
          },
        },
      });
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getPaidInstallments', async (_event, { token, year = 0, semester = 0 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { status: 'PAYE' };
      // year = 0 → toutes les périodes ; sinon filtre sur l'année, éventuellement
      // restreint au 1er semestre (janv.–juin) ou au 2e (juil.–déc.).
      if (year > 0) {
        let start: Date;
        let end: Date;
        if (semester === 1) {
          start = new Date(year, 0, 1);
          end = new Date(year, 6, 1);
        } else if (semester === 2) {
          start = new Date(year, 6, 1);
          end = new Date(year + 1, 0, 1);
        } else {
          start = new Date(year, 0, 1);
          end = new Date(year + 1, 0, 1);
        }
        where.paidAt = { gte: start, lt: end };
      }
      const data = await db.saleInstallment.findMany({
        where,
        orderBy: { paidAt: 'desc' },
        include: {
          convention: {
            select: {
              id: true,
              reference: true,
              assetType: true,
              client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
              properties: {
                orderBy: { order: 'asc' },
                select: { property: { select: { id: true, reference: true, address: true, city: true } } },
              },
              terrains: {
                orderBy: { order: 'asc' },
                select: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
              },
            },
          },
        },
      });
      const totalAmount = data.reduce((sum, i) => sum + Number(i.amount), 0);
      return ser({ success: true, data, total: data.length, totalAmount });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:payInstallment', async (_event, { token, installmentId, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, WRITE_ROLES);
      const parsed = installmentPaymentSchema.safeParse({ installmentId, ...payload });
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;

      const installment = await db.saleInstallment.findUnique({
        where: { id: d.installmentId },
        include: { convention: { select: { id: true, reference: true, clientId: true } } },
      });
      if (!installment) return { success: false, error: 'Échéance introuvable' };
      if (installment.status === 'PAYE') return { success: false, error: 'Échéance déjà payée' };

      // Vérifie le compte de trésorerie si l'encaissement y est rattaché.
      if (d.bankAccountId) {
        const account = await db.bankAccount.findUnique({ where: { id: d.bankAccountId } });
        if (!account || account.deletedAt) return { success: false, error: 'Compte de trésorerie introuvable' };
      }

      const paidAt = d.paidAt ? new Date(d.paidAt) : new Date();
      const amount = Number(installment.amount);
      // Référence de facture pré-calculée hors transaction (lecture seule).
      const invoiceRef = installment.invoiceId ? null : await nextInvoiceRef(db);

      const result = await db.$transaction(async (tx) => {
        const updated = await tx.saleInstallment.update({
          where: { id: d.installmentId },
          data: {
            status: 'PAYE',
            paidAt,
            paymentMethod: d.method,
            paymentRef: d.paymentRef,
            notes: d.notes,
          },
        });
        let invoiceId = installment.invoiceId;
        // Crée automatiquement la facture d'échéance (type ECHEANCE_VENTE) si absente.
        if (invoiceRef) {
          const invoice = await tx.invoice.create({
            data: {
              reference: invoiceRef,
              type: 'ECHEANCE_VENTE',
              status: 'PAYEE',
              clientId: installment.convention.clientId,
              conventionId: installment.conventionId,
              subtotal: amount as any,
              taxRate: 0 as any,
              taxAmount: 0 as any,
              total: amount as any,
              issueDate: paidAt,
              dueDate: installment.dueDate,
              paidAt,
              items: {
                create: [{
                  description: `Échéance n°${installment.installmentNumber} — convention ${installment.convention.reference}`,
                  quantity: 1 as any,
                  unitPrice: amount as any,
                  total: amount as any,
                }],
              },
              payments: {
                create: [{
                  amount: amount as any,
                  method: d.method,
                  paidAt,
                  reference: d.paymentRef,
                  bankAccountId: d.bankAccountId ?? null,
                }],
              },
            },
          });
          await tx.saleInstallment.update({
            where: { id: d.installmentId },
            data: { invoiceId: invoice.id },
          });
          invoiceId = invoice.id;
        }
        // Règlement rattaché à un compte → mouvement de trésorerie (entrée).
        if (d.bankAccountId) {
          await recordTreasuryOperation(tx, {
            bankAccountId: d.bankAccountId,
            direction: 'ENTREE',
            amount,
            label: `Échéance n°${installment.installmentNumber} — convention ${installment.convention.reference}`,
            operationDate: paidAt,
            categoryId: d.categoryId ?? null,
            paymentMethod: d.method,
            paymentRef: d.paymentRef,
            source: 'ECHEANCE',
            installmentId: d.installmentId,
            createdById: session.userId,
          });
        }
        return { updated, invoiceId };
      });

      logger.info(`Installment paid: id=${d.installmentId} convention=${installment.convention.reference} invoice=${result.invoiceId ?? '—'}`);
      return ser({ success: true, data: { ...result.updated, invoiceId: result.invoiceId } });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getCancelledInstallments', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const data = await db.saleInstallment.findMany({
        where: { status: 'ANNULE' },
        orderBy: { dueDate: 'asc' },
        include: {
          convention: {
            select: {
              id: true,
              reference: true,
              assetType: true,
              client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
              properties: {
                orderBy: { order: 'asc' },
                select: { property: { select: { id: true, reference: true, address: true, city: true } } },
              },
              terrains: {
                orderBy: { order: 'asc' },
                select: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
              },
            },
          },
        },
      });
      return ser({ success: true, data, total: data.length });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:cancelInstallment', async (_event, { token, installmentId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, WRITE_ROLES);
      const db = getDb();
      const installment = await db.saleInstallment.findUnique({
        where: { id: installmentId },
        select: { id: true, status: true },
      });
      if (!installment) return { success: false, error: 'Échéance introuvable' };
      if (installment.status === 'PAYE') {
        return { success: false, error: 'Impossible d\'annuler une échéance déjà payée' };
      }
      if (installment.status === 'ANNULE') {
        return { success: false, error: 'Échéance déjà annulée' };
      }
      const updated = await db.saleInstallment.update({
        where: { id: installmentId },
        data: { status: 'ANNULE' },
      });
      logger.info(`Installment cancelled: id=${installmentId}`);
      return ser({ success: true, data: updated });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:reinstateInstallment', async (_event, { token, installmentId }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, WRITE_ROLES);
      const db = getDb();
      const installment = await db.saleInstallment.findUnique({
        where: { id: installmentId },
        select: { id: true, status: true, dueDate: true },
      });
      if (!installment) return { success: false, error: 'Échéance introuvable' };
      if (installment.status !== 'ANNULE') {
        return { success: false, error: 'Seule une échéance annulée peut être réintégrée' };
      }
      // Restaure le statut selon l'échéance : en retard si dépassée, sinon en attente.
      const newStatus = installment.dueDate < new Date() ? 'EN_RETARD' : 'EN_ATTENTE';
      const updated = await db.saleInstallment.update({
        where: { id: installmentId },
        data: { status: newStatus },
      });
      logger.info(`Installment reinstated: id=${installmentId} status=${newStatus}`);
      return ser({ success: true, data: updated });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getSaleConventions', async (_event, { token, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkAccountingRole(session, READ_ROLES);
      const db = getDb();
      const [conventions, total] = await db.$transaction([
        db.convention.findMany({
          where: { type: 'SALE', deletedAt: null, status: { not: 'ANNULE' } },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            properties: {
              orderBy: { order: 'asc' },
              include: { property: { select: { id: true, reference: true, address: true, city: true } } },
            },
            terrains: {
              orderBy: { order: 'asc' },
              include: { terrain: { select: { id: true, reference: true, numeroIlot: true, numeroParcelle: true } } },
            },
            installments: { select: { status: true, amount: true } },
          },
        }),
        db.convention.count({ where: { type: 'SALE', deletedAt: null, status: { not: 'ANNULE' } } }),
      ]);

      const data = conventions.map((c) => {
        const total = c.installments.reduce((s, i) => s + Number(i.amount), 0);
        const paid = c.installments.filter((i) => i.status === 'PAYE').reduce((s, i) => s + Number(i.amount), 0);
        const overdue = c.installments.filter((i) => i.status === 'EN_RETARD').length;
        return {
          ...c,
          saleAmount: Number(c.saleAmount ?? 0),
          installmentTotal: total,
          installmentPaid: paid,
          installmentRemaining: total - paid,
          overdueCount: overdue,
          installmentsPaidCount: c.installments.filter((i) => i.status === 'PAYE').length,
          installmentsTotal: c.installments.length,
        };
      });

      return ser({ success: true, data, total });
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
