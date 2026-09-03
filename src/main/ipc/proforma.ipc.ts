import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Factures Proforma — document optionnel, non comptable, produit avant un
 * achat de terrain ou de bien immobilier, à la demande d'un client ou d'un
 * prospect (ex. justificatif de décaissement bancaire). Toujours généré à
 * partir d'un Devis (Vente terrain/bien) ou d'une Convention encore en
 * Brouillon (avant signature), et figé (instantané) au moment de l'émission —
 * un changement ultérieur du devis/de la convention source ne modifie jamais
 * une proforma déjà émise.
 *
 * Lecture : vue complète pour SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT, sinon
 * limitée aux proformas émises par l'utilisateur (`createdById`), même
 * principe que le module Devis. Émission : voir `assertCanIssueProforma`
 * (réservée à SUPER_ADMIN/ADMIN/MANAGER/ACCOUNTANT, rôle exact). Suppression :
 * réservée à SUPER_ADMIN/ADMIN/MANAGER, même périmètre que la suppression d'un devis.
 */
const FULL_ACCESS_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];
const DELETE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...FULL_ACCESS_ROLES, 'AGENT', 'AGENT_TECHNIQUE', 'ASSISTANTE_DIRECTION', 'READONLY'];

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const dec = (v: number | null | undefined): unknown => (v == null ? null : (String(v) as never));
const round2 = (n: number) => Math.round(n * 100) / 100;

interface ProformaItem {
  designation: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  total: number;
}

/** Filtre de visibilité (liste) : vue complète ou limitée à ses propres proformas émises. */
function scopeWhere(session: { role: string; userId: number }): Record<string, unknown> {
  return FULL_ACCESS_ROLES.includes(session.role) ? {} : { createdById: session.userId };
}

function canAccessRecord(session: { role: string; userId: number }, createdById: number | null): boolean {
  return FULL_ACCESS_ROLES.includes(session.role) || createdById === session.userId;
}

/** Nom d'affichage d'un client (particulier ou entreprise). */
function clientLabel(cl: any): string {
  if (!cl) return '';
  return cl.type === 'INDIVIDUEL'
    ? `${cl.lastName ?? ''} ${cl.firstName ?? ''}`.trim()
    : (cl.entreprise ?? '');
}

/** Nom d'affichage d'un prospect (toujours un particulier). */
function prospectLabel(p: any): string {
  if (!p) return '';
  return `${p.lastName ?? ''} ${p.firstName ?? ''}`.trim();
}

/** Référence auto PRO-YYYY-NNNN (séquence annuelle). */
async function nextProformaReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.proformaInvoice.findFirst({
    where: { reference: { startsWith: `PRO-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `PRO-${year}-${String(seq).padStart(4, '0')}`;
}

/**
 * Émission d'une facture Proforma (depuis un devis ou une convention) —
 * réservée à SUPER_ADMIN, ADMIN, MANAGER et ACCOUNTANT (Comptable), aucun
 * autre rôle. Contrôle de rôle **exact** (`FULL_ACCESS_ROLES.includes`, pas
 * `checkRole`) : contrairement à son équivalence habituelle avec MANAGER
 * ailleurs dans l'app, ASSISTANTE_DIRECTION n'hérite PAS de ce droit ici, pas
 * plus qu'AGENT/AGENT_TECHNIQUE (qui pouvaient jusqu'ici émettre une proforma
 * sur leurs propres devis/conventions référentes — droit retiré).
 */
function assertCanIssueProforma(session: { role: string }): void {
  if (!FULL_ACCESS_ROLES.includes(session.role)) {
    throw new Error('Permission insuffisante pour émettre une facture Proforma.');
  }
}

const createFromQuoteSchema = z.object({
  quoteId: z.number().int().positive(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const createFromConventionSchema = z.object({
  conventionId: z.number().int().positive(),
  validUntil: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  // Aucune TVA n'est portée par une Convention (montants négociés en net) —
  // laissée à la discrétion de l'émetteur au cas par cas.
  taxRate: z.number().min(0).max(100).default(0),
});

export function registerProformaIPC(): void {
  ipcMain.handle('proforma:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null, ...scopeWhere(session) };
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { recipientLabel: { contains: filters.search } },
        ];
      }
      if (filters.sourceType) where.sourceType = filters.sourceType;
      if (filters.clientId) where.clientId = Number(filters.clientId);
      if (filters.prospectId) where.prospectId = Number(filters.prospectId);
      const [data, total] = await db.$transaction([
        db.proformaInvoice.findMany({
          where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
        }),
        db.proformaInvoice.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('proforma:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proforma:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const proforma = await db.proformaInvoice.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!proforma) return { success: false, error: 'Facture Proforma introuvable' };
      if (!canAccessRecord(session, proforma.createdById)) return { success: false, error: 'Facture Proforma inaccessible' };
      return ser({ success: true, data: proforma });
    } catch (error: any) {
      logger.error('proforma:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proforma:createFromQuote', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      assertCanIssueProforma(session);
      const parsed = createFromQuoteSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const db = getDb();
      const quote = await db.quote.findFirst({
        where: { id: d.quoteId, deletedAt: null },
        include: {
          client: { select: { id: true, type: true, firstName: true, lastName: true, entreprise: true, phone: true, mobile: true, email: true } },
          prospect: { select: { id: true, firstName: true, lastName: true, phone: true, mobile: true, email: true } },
          items: { orderBy: { order: 'asc' } },
          terrains: { orderBy: { order: 'asc' }, include: { terrain: { select: { reference: true, numeroIlot: true, numeroParcelle: true, lotissement: { select: { nom: true } } } } } },
          properties: { orderBy: { order: 'asc' }, include: { property: { select: { reference: true, address: true, city: true } } } },
          terrain: { select: { reference: true, numeroIlot: true, numeroParcelle: true, lotissement: { select: { nom: true } } } },
          property: { select: { reference: true, address: true, city: true } },
        },
      });
      if (!quote) return { success: false, error: 'Devis introuvable' };
      if (!['VENTE_TERRAIN', 'VENTE_BIEN'].includes(quote.type)) {
        return { success: false, error: "Seul un devis de vente (terrain ou bien immobilier) peut donner lieu à une facture Proforma." };
      }

      const recipientLabel = quote.client ? clientLabel(quote.client) : prospectLabel(quote.prospect);
      const recipientPhone = quote.client ? (quote.client.phone ?? quote.client.mobile ?? null) : (quote.prospect?.phone ?? quote.prospect?.mobile ?? null);
      const recipientEmail = quote.client ? (quote.client.email ?? null) : (quote.prospect?.email ?? null);

      const terrainsList = quote.terrains.length ? quote.terrains.map((l: any) => l.terrain) : (quote.terrain ? [quote.terrain] : []);
      const propertiesList = quote.properties.length ? quote.properties.map((l: any) => l.property) : (quote.property ? [quote.property] : []);
      const terrainDesc = terrainsList.map((t: any) => `${t.reference}${t.lotissement?.nom ? ` (${t.lotissement.nom})` : ''}`).join(', ');
      const propertyDesc = propertiesList.map((p: any) => `${p.reference}${p.address ? ` — ${p.address}` : ''}`).join(', ');
      const designation = (quote.objet && quote.objet.trim())
        || [terrainDesc && `Terrain(s) : ${terrainDesc}`, propertyDesc && `Bien(s) : ${propertyDesc}`].filter(Boolean).join(' — ')
        || quote.reference;

      const items: ProformaItem[] = quote.items
        .filter((it: any) => it.lineType === 'ARTICLE' && Number(it.quantity) > 0)
        .map((it: any) => ({
          designation: it.designation, quantity: Number(it.quantity), unit: it.unit ?? null,
          unitPrice: Number(it.unitPrice), total: Number(it.total),
        }));
      const discountAmount = Number(quote.discountAmount ?? 0);
      if (discountAmount > 0) {
        items.push({ designation: 'Remise', quantity: 1, unit: null, unitPrice: -discountAmount, total: -discountAmount });
      }
      const subtotal = round2(items.reduce((s, it) => s + it.total, 0));

      const reference = await nextProformaReference(db);
      const created = await db.proformaInvoice.create({
        data: {
          reference, sourceType: 'QUOTE',
          quoteId: quote.id, quoteReference: quote.reference,
          clientId: quote.clientId, prospectId: quote.prospectId,
          recipientLabel, recipientPhone, recipientEmail,
          designation, items: items as any,
          subtotal: dec(subtotal) as any,
          taxRate: dec(Number(quote.taxRate ?? 0)) as any,
          taxAmount: dec(Number(quote.taxAmount ?? 0)) as any,
          total: dec(Number(quote.total ?? 0)) as any,
          validUntil: d.validUntil ? new Date(d.validUntil) : null,
          notes: d.notes?.trim() || null,
          createdById: session.userId,
        },
      });
      logger.info(`Facture Proforma générée depuis le devis ${quote.reference} : ${reference}`);
      return ser({ success: true, data: created });
    } catch (error: any) {
      logger.error('proforma:createFromQuote error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proforma:createFromConvention', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      assertCanIssueProforma(session);
      const parsed = createFromConventionSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? 'Données invalides' };
      const d = parsed.data;
      const db = getDb();
      const convention = await db.convention.findFirst({
        where: { id: d.conventionId, deletedAt: null },
        include: {
          client: { select: { id: true, type: true, firstName: true, lastName: true, entreprise: true, phone: true, mobile: true, email: true } },
          prospect: { select: { id: true, firstName: true, lastName: true, phone: true, mobile: true, email: true } },
          terrains: { orderBy: { order: 'asc' }, include: { terrain: { select: { reference: true, numeroIlot: true, numeroParcelle: true, lotissement: { select: { nom: true } } } } } },
          properties: { orderBy: { order: 'asc' }, include: { property: { select: { reference: true, address: true, city: true } } } },
        },
      });
      if (!convention) return { success: false, error: 'Convention introuvable' };
      if (!['SALE', 'SOUSCRIPTION'].includes(convention.type)) {
        return { success: false, error: "Seule une convention de vente ou de souscription peut donner lieu à une facture Proforma." };
      }
      if (convention.status !== 'BROUILLON') {
        return { success: false, error: "La facture Proforma ne peut être émise que sur une convention encore en Brouillon (avant signature)." };
      }

      const recipientLabel = convention.client ? clientLabel(convention.client) : prospectLabel(convention.prospect);
      const recipientPhone = convention.client ? (convention.client.phone ?? convention.client.mobile ?? null) : (convention.prospect?.phone ?? convention.prospect?.mobile ?? null);
      const recipientEmail = convention.client ? (convention.client.email ?? null) : (convention.prospect?.email ?? null);

      const terrainsList = convention.terrains.map((l: any) => l.terrain);
      const propertiesList = convention.properties.map((l: any) => l.property);
      const terrainDesc = terrainsList.map((t: any) => `${t.reference}${t.lotissement?.nom ? ` (${t.lotissement.nom})` : ''}`).join(', ');
      const propertyDesc = propertiesList.map((p: any) => `${p.reference}${p.address ? ` — ${p.address}` : ''}`).join(', ');
      const designation = convention.lotsSouscrits
        || [terrainDesc && `Terrain(s) : ${terrainDesc}`, propertyDesc && `Bien(s) : ${propertyDesc}`].filter(Boolean).join(' — ')
        || convention.reference;

      const amount = Number(convention.saleAmount ?? 0);
      const items: ProformaItem[] = [{ designation: designation || convention.reference, quantity: 1, unit: null, unitPrice: amount, total: amount }];
      const taxRate = d.taxRate;
      const taxAmount = round2((amount * taxRate) / 100);
      const total = round2(amount + taxAmount);

      const reference = await nextProformaReference(db);
      const created = await db.proformaInvoice.create({
        data: {
          reference, sourceType: 'CONVENTION',
          conventionId: convention.id, conventionReference: convention.reference,
          clientId: convention.clientId, prospectId: convention.prospectId,
          recipientLabel, recipientPhone, recipientEmail,
          designation, items: items as any,
          subtotal: dec(amount) as any,
          taxRate: dec(taxRate) as any,
          taxAmount: dec(taxAmount) as any,
          total: dec(total) as any,
          validUntil: d.validUntil ? new Date(d.validUntil) : null,
          notes: d.notes?.trim() || null,
          createdById: session.userId,
        },
      });
      logger.info(`Facture Proforma générée depuis la convention ${convention.reference} : ${reference}`);
      return ser({ success: true, data: created });
    } catch (error: any) {
      logger.error('proforma:createFromConvention error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('proforma:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, DELETE_ROLES);
      const db = getDb();
      const existing = await db.proformaInvoice.findFirst({ where: { id: Number(id), deletedAt: null } });
      if (!existing) return { success: false, error: 'Facture Proforma introuvable' };
      await db.proformaInvoice.update({ where: { id: Number(id) }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      logger.error('proforma:delete error', error.message);
      return { success: false, error: error.message };
    }
  });
}
