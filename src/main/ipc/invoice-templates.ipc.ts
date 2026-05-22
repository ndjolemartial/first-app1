import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

type Db = ReturnType<typeof getDb>;

const READ_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT', 'READONLY'];
const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'ACCOUNTANT'];

/** Types de facture pris en charge pour l'assignation d'un modèle par défaut. */
export const INVOICE_TYPES = [
  'VENTE', 'ECHEANCE_VENTE', 'FRAIS_AGENCE', 'FRAIS_DE_GESTION', 'AVANCE', 'CAUTION', 'OTHER',
] as const;

/** Préfixe des clés AppSetting de correspondance type de facture → modèle. */
const SETTING_PREFIX = 'invoice.template.';

/** Sérialise pour l'IPC (les DateTime ne sont pas clonables tels quels). */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Les 3 modèles de facture livrés par défaut. */
const SEED_TEMPLATES = [
  {
    name: 'Classique',
    layout: 'CLASSIQUE',
    accentColor: '#1E3A5F',
    headerHtml: '<p><strong style="font-size:18px">AFRIKIMMO</strong><br>Gestion immobilière</p>',
    footerHtml: '<p>Merci de votre confiance. Règlement à réception de facture.</p>',
  },
  {
    name: 'Moderne',
    layout: 'MODERNE',
    accentColor: '#2563EB',
    headerHtml: '<p><strong style="font-size:18px">AFRIKIMMO</strong><br>Votre partenaire immobilier</p>',
    footerHtml: '<p>Document à valeur indicative — merci de votre confiance.</p>',
  },
  {
    name: 'Compact',
    layout: 'COMPACT',
    accentColor: '#0F766E',
    headerHtml: '<p><strong>AFRIKIMMO</strong> — Gestion immobilière</p>',
    footerHtml: '<p>Merci de votre confiance.</p>',
  },
];

/**
 * S'assure que les 3 modèles de facture existent (création unique au premier appel).
 * @returns la liste des modèles, triés par id.
 */
export async function ensureInvoiceTemplates(db: Db) {
  const count = await db.invoiceTemplate.count();
  if (count === 0) {
    for (const t of SEED_TEMPLATES) {
      await db.invoiceTemplate.create({ data: t as any });
    }
    logger.info('Invoice templates seeded (3 modèles)');
  }
  return db.invoiceTemplate.findMany({ orderBy: { id: 'asc' } });
}

/** Lit la correspondance type de facture → identifiant de modèle. */
export async function getInvoiceTemplateDefaults(db: Db): Promise<Record<string, number>> {
  const keys = INVOICE_TYPES.map((t) => SETTING_PREFIX + t);
  const settings = await db.appSetting.findMany({ where: { key: { in: keys } } });
  const map: Record<string, number> = {};
  for (const s of settings) {
    const type = s.key.slice(SETTING_PREFIX.length);
    const id = Number(s.value);
    if (Number.isFinite(id)) map[type] = id;
  }
  return map;
}

/**
 * Résout le modèle de facture à appliquer pour un type de facture donné :
 * le modèle par défaut configuré pour ce type, sinon le premier modèle.
 */
export async function resolveInvoiceTemplate(db: Db, invoiceType: string) {
  const templates = await ensureInvoiceTemplates(db);
  if (templates.length === 0) return null;
  const defaults = await getInvoiceTemplateDefaults(db);
  const defaultId = defaults[invoiceType];
  return templates.find((t) => t.id === defaultId) ?? templates[0];
}

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  layout: z.enum(['CLASSIQUE', 'MODERNE', 'COMPACT']).optional(),
  headerHtml: z.string().optional(),
  footerHtml: z.string().optional(),
  accentColor: z.string().optional(),
});

/**
 * Enregistre les handlers IPC pour les modèles de facture.
 */
export function registerInvoiceTemplatesIPC(): void {
  ipcMain.handle('invoiceTemplates:list', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const templates = await ensureInvoiceTemplates(db);
      const defaults = await getInvoiceTemplateDefaults(db);
      return ser({ success: true, data: { templates, defaults } });
    } catch (error: any) {
      logger.error('invoiceTemplates:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoiceTemplates:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = updateTemplateSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const template = await db.invoiceTemplate.update({ where: { id }, data: parsed.data });
      logger.info(`Invoice template updated: id=${id}`);
      return ser({ success: true, data: template });
    } catch (error: any) {
      logger.error('invoiceTemplates:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('invoiceTemplates:setDefaults', async (_event, { token, defaults }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      const entries = Object.entries(defaults ?? {}) as [string, unknown][];
      for (const [type, templateId] of entries) {
        if (!(INVOICE_TYPES as readonly string[]).includes(type)) continue;
        const id = Number(templateId);
        if (!Number.isFinite(id) || id <= 0) continue;
        const key = SETTING_PREFIX + type;
        await db.appSetting.upsert({
          where: { key },
          create: { key, value: String(id) },
          update: { value: String(id) },
        });
      }
      logger.info(`Invoice template defaults updated by user=${session.userId}`);
      return { success: true, data: await getInvoiceTemplateDefaults(db) };
    } catch (error: any) {
      logger.error('invoiceTemplates:setDefaults error', error.message);
      return { success: false, error: error.message };
    }
  });
}
