import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

const invoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  total: z.number().positive(),
});

const invoiceSchema = z.object({
  type: z.enum(['VENTE', 'ECHEANCE_VENTE', 'FRAIS_AGENCE', 'FRAIS_DE_GESTION', 'AVANCE', 'CAUTION', 'OTHER']),
  clientId: z.number().int().optional(),
  contractId: z.number().int().optional(),
  subtotal: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100).default(0),
  taxAmount: z.number().nonnegative(),
  total: z.number().nonnegative(),
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
});

const installmentPaymentSchema = z.object({
  installmentId: z.number().int().positive(),
  method: z.enum(['ESPECE', 'CHEQUE', 'TRANSFERT', 'VIREMENT', 'MOBILE_MONEY']),
  paymentRef: z.string().optional(),
  notes: z.string().optional(),
  paidAt: z.string().datetime().optional(),
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
 * Enregistre les handlers IPC pour la comptabilité.
 */
export function registerAccountingIPC(): void {

  /* ─── Tableau de bord financier ─────────────────────────────────── */

  ipcMain.handle('accounting:getDashboard', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const [
        invoiceStats,
        overdueInstallments,
        upcomingInstallments,
        activeContracts,
        monthlyRevenue,
      ] = await db.$transaction([
        // Total facturé ce mois / encours / impayés
        db.invoice.aggregate({
          where: { deletedAt: null },
          _sum: { total: true },
          _count: true,
        }),
        // Échéances en retard
        db.saleInstallment.aggregate({
          where: { status: 'EN_RETARD' },
          _count: true,
          _sum: { amount: true },
        }),
        // Échéances à régler dans les 30 jours
        db.saleInstallment.count({
          where: {
            status: { in: ['EN_ATTENTE', 'A_REGLER'] },
            dueDate: { lte: new Date(now.getTime() + 30 * 24 * 3600 * 1000) },
          },
        }),
        // Contrats actifs
        db.contract.count({ where: { status: 'ACTIVE', deletedAt: null } }),
        // CA du mois (factures payées ce mois)
        db.invoice.aggregate({
          where: {
            deletedAt: null,
            status: 'PAYEE',
            paidAt: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { total: true },
        }),
      ]);

      // Impayés (factures ENVOYEE + EN_RETARD)
      const unpaidTotal = await db.invoice.aggregate({
        where: { deletedAt: null, status: { in: ['ENVOYEE', 'EN_RETARD', 'PARTIEL'] } },
        _sum: { total: true },
        _count: true,
      });

      // Revenus des 6 derniers mois (pour graphique)
      const revenueByMonth: { month: string; amount: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        const agg = await db.invoice.aggregate({
          where: { deletedAt: null, status: 'PAYEE', paidAt: { gte: start, lte: end } },
          _sum: { total: true },
        });
        revenueByMonth.push({
          month: start.toISOString().slice(0, 7),
          amount: Number(agg._sum.total ?? 0),
        });
      }

      return {
        success: true,
        data: {
          totalInvoices: invoiceStats._count,
          totalAmount: Number(invoiceStats._sum.total ?? 0),
          unpaidCount: unpaidTotal._count,
          unpaidAmount: Number(unpaidTotal._sum.total ?? 0),
          overdueInstallmentsCount: overdueInstallments._count,
          overdueInstallmentsAmount: Number(overdueInstallments._sum.amount ?? 0),
          upcomingInstallmentsCount: upcomingInstallments,
          activeContracts,
          monthlyRevenue: Number(monthlyRevenue._sum.total ?? 0),
          revenueByMonth,
        },
      };
    } catch (error: any) {
      logger.error('accounting:getDashboard error', error.message);
      return { success: false, error: error.message };
    }
  });

  /* ─── Factures ───────────────────────────────────────────────────── */

  ipcMain.handle('accounting:getInvoices', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.status) where.status = filters.status;
      if (filters.clientId) where.clientId = filters.clientId;
      if (filters.contractId) where.contractId = filters.contractId;
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
            contract: { select: { id: true, reference: true, type: true } },
            _count: { select: { payments: true } },
          },
        }),
        db.invoice.count({ where }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      logger.error('accounting:getInvoices error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getInvoiceById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const invoice = await db.invoice.findUnique({
        where: { id, deletedAt: null },
        include: {
          client: true,
          contract: { include: { property: { select: { id: true, reference: true, address: true, city: true } } } },
          items: true,
          payments: { orderBy: { paidAt: 'desc' } },
        },
      });
      if (!invoice) return { success: false, error: 'Facture introuvable' };
      return { success: true, data: invoice };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:createInvoice', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = invoiceSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextInvoiceRef(db);
      const d = parsed.data;
      const invoice = await db.invoice.create({
        data: {
          reference,
          type: d.type,
          status: 'BROUILLON' as any,
          clientId: d.clientId,
          contractId: d.contractId,
          subtotal: d.subtotal as any,
          taxRate: d.taxRate as any,
          taxAmount: d.taxAmount as any,
          total: d.total as any,
          issueDate: new Date(),
          dueDate: new Date(d.dueDate),
          notes: d.notes,
          items: { create: d.items.map((item) => ({ ...item, quantity: item.quantity as any, unitPrice: item.unitPrice as any, total: item.total as any })) },
        },
        include: { items: true },
      });
      logger.info(`Invoice created: ${invoice.reference}`);
      return { success: true, data: invoice };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:updateInvoiceStatus', async (_event, { token, id, status }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const invoice = await db.invoice.update({
        where: { id, deletedAt: null },
        data: { status, ...(status === 'PAYEE' && { paidAt: new Date() }) },
        select: { id: true, status: true, reference: true },
      });
      return { success: true, data: invoice };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:addPayment', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = paymentSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;

      const invoice = await db.invoice.findUnique({
        where: { id: d.invoiceId },
        include: { payments: true },
      });
      if (!invoice) return { success: false, error: 'Facture introuvable' };

      const payment = await db.payment.create({
        data: {
          invoiceId: d.invoiceId,
          amount: d.amount as any,
          method: d.method,
          paidAt: d.paidAt ? new Date(d.paidAt) : new Date(),
          reference: d.reference,
          notes: d.notes,
        },
      });

      // Recalcule le total payé et met à jour le statut de la facture
      const totalPaid = invoice.payments.reduce((s, p) => s + Number(p.amount), 0) + d.amount;
      const invoiceTotal = Number(invoice.total);
      let newStatus: string;
      if (totalPaid >= invoiceTotal) newStatus = 'PAYEE';
      else if (totalPaid > 0) newStatus = 'PARTIEL';
      else newStatus = invoice.status;

      await db.invoice.update({
        where: { id: d.invoiceId },
        data: {
          status: newStatus as any,
          ...(newStatus === 'PAYEE' && { paidAt: new Date() }),
        },
      });

      logger.info(`Payment recorded: invoice=${d.invoiceId} amount=${d.amount}`);
      return { success: true, data: payment };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  /* ─── Échéances de vente ─────────────────────────────────────────── */

  ipcMain.handle('accounting:getOverdueInstallments', async (_event, { token, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();

      // Met à jour les statuts EN_ATTENTE qui sont maintenant dépassées
      await db.saleInstallment.updateMany({
        where: {
          status: { in: ['EN_ATTENTE', 'A_REGLER'] },
          dueDate: { lt: new Date() },
        },
        data: { status: 'EN_RETARD' },
      });

      const [data, total] = await db.$transaction([
        db.saleInstallment.findMany({
          where: { status: 'EN_RETARD' },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { dueDate: 'asc' },
          include: {
            contract: {
              select: {
                id: true,
                reference: true,
                client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                property: { select: { id: true, reference: true, address: true, city: true } },
              },
            },
          },
        }),
        db.saleInstallment.count({ where: { status: 'EN_RETARD' } }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getUpcomingInstallments', async (_event, { token, days = 30, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const until = new Date(Date.now() + days * 24 * 3600 * 1000);
      const [data, total] = await db.$transaction([
        db.saleInstallment.findMany({
          where: {
            status: { in: ['EN_ATTENTE', 'A_REGLER'] },
            dueDate: { lte: until, gte: new Date() },
          },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { dueDate: 'asc' },
          include: {
            contract: {
              select: {
                id: true,
                reference: true,
                client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
                property: { select: { id: true, reference: true, address: true, city: true } },
              },
            },
          },
        }),
        db.saleInstallment.count({
          where: {
            status: { in: ['EN_ATTENTE', 'A_REGLER'] },
            dueDate: { lte: until, gte: new Date() },
          },
        }),
      ]);
      return { success: true, data, total };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:payInstallment', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = installmentPaymentSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;

      const installment = await db.saleInstallment.findUnique({
        where: { id: d.installmentId },
        include: { contract: { select: { reference: true } } },
      });
      if (!installment) return { success: false, error: 'Échéance introuvable' };
      if (installment.status === 'PAYE') return { success: false, error: 'Échéance déjà payée' };

      const updated = await db.saleInstallment.update({
        where: { id: d.installmentId },
        data: {
          status: 'PAYE',
          paidAt: d.paidAt ? new Date(d.paidAt) : new Date(),
          paymentMethod: d.method,
          paymentRef: d.paymentRef,
          notes: d.notes,
        },
      });

      logger.info(`Installment paid: id=${d.installmentId} contract=${installment.contract.reference}`);
      return { success: true, data: updated };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('accounting:getSaleContracts', async (_event, { token, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const [contracts, total] = await db.$transaction([
        db.contract.findMany({
          where: { type: 'SALE', deletedAt: null, status: { not: 'ANNULE' } },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: {
            client: { select: { id: true, firstName: true, lastName: true, entreprise: true, type: true } },
            property: { select: { id: true, reference: true, address: true, city: true } },
            installments: { select: { status: true, amount: true } },
          },
        }),
        db.contract.count({ where: { type: 'SALE', deletedAt: null, status: { not: 'ANNULE' } } }),
      ]);

      const data = contracts.map((c) => {
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

      return { success: true, data, total };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
