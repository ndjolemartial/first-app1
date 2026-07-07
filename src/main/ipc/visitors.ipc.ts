import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

/**
 * Module Gestion des visiteurs.
 *
 * Accès réservé aux rôles SUPER_ADMIN, ADMIN et ASSISTANTE_DIRECTION (accueil /
 * secrétariat). Les visiteurs eux-mêmes s'enregistrent via l'application web
 * autonome (dossier `web-visiteurs/`) ; l'accueil peut aussi les saisir ici.
 */

// Accès au module Gestion des visiteurs (liste, saisie, lecture des objets pour
// le sélecteur du formulaire). MANAGER inclus.
const VISITOR_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION', 'MANAGER'];

// Gestion (écriture) des « Objets de visite » — MANAGER exclu : il accède au
// module visiteurs mais pas à la configuration des objets.
const VISITOR_OBJECT_ROLES = ['SUPER_ADMIN', 'ADMIN', 'ASSISTANTE_DIRECTION'];

/**
 * Contrôle de rôle EXACT pour le module visiteurs (n'applique pas les
 * équivalences de `checkRole`) : autoriser `MANAGER` explicitement sans faire
 * entrer ACCOUNTANT (équivalent MANAGER). Aligné sur le RoleGuard (match exact).
 */
function checkVisitorRole(session: { role: string }, allowed: string[]): void {
  if (!allowed.includes(session.role)) throw new Error('Permission insuffisante');
}

const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

const emptyToUndef = (v: unknown) => (v === '' || v === null ? undefined : v);

const visitorSchema = z.object({
  firstName: z.string().min(1, 'Prénoms requis'),
  lastName: z.string().min(1, 'Nom requis').transform((s) => s.trim().toUpperCase()),
  company: z.preprocess(emptyToUndef, z.string().optional()),
  phone: z.string().min(1, 'Contacts requis'),
  email: z.preprocess(emptyToUndef, z.string().email('Email invalide').optional()),
  objet: z.string().min(1, 'Objet de visite requis'),
  details: z.preprocess(emptyToUndef, z.string().optional()),
});

export function registerVisitorsIPC(): void {
  ipcMain.handle('visitors:list', async (_event, { token, filters = {}, page = 1, limit = 20 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.search) {
        where.OR = [
          { firstName: { contains: filters.search } },
          { lastName: { contains: filters.search } },
          { company: { contains: filters.search } },
          { objet: { contains: filters.search } },
          { phone: { contains: filters.search } },
          { email: { contains: filters.search } },
        ];
      }
      if (filters.source) where.source = filters.source;
      if (filters.dateFrom || filters.dateTo) {
        where.visitedAt = {};
        if (filters.dateFrom) where.visitedAt.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.visitedAt.lte = new Date(filters.dateTo);
      }
      const [data, total] = await db.$transaction([
        db.visitor.findMany({
          where,
          include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { visitedAt: 'desc' },
        }),
        db.visitor.count({ where }),
      ]);
      return ser({ success: true, data, total });
    } catch (error: any) {
      logger.error('visitors:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_ROLES);
      const db = getDb();
      const visitor = await db.visitor.findFirst({
        where: { id, deletedAt: null },
        include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
      });
      if (!visitor) return { success: false, error: 'Visiteur introuvable' };
      return ser({ success: true, data: visitor });
    } catch (error: any) {
      logger.error('visitors:getById error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_ROLES);
      const parsed = visitorSchema.safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
      // Saisie depuis l'application = source INTERNE ; visitedAt auto (now).
      const visitor = await db.visitor.create({
        data: { ...parsed.data, source: 'INTERNE', createdById: session.userId },
      });
      logger.info(`Visiteur créé : ${visitor.id}`);
      return ser({ success: true, data: visitor });
    } catch (error: any) {
      logger.error('visitors:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_ROLES);
      const parsed = visitorSchema.partial().safeParse(payload);
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => `${i.path.join('.') || 'champ'} : ${i.message}`).join(' ; ');
        return { success: false, error: msg };
      }
      const db = getDb();
      const visitor = await db.visitor.update({ where: { id }, data: parsed.data });
      return ser({ success: true, data: visitor });
    } catch (error: any) {
      logger.error('visitors:update error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_ROLES);
      const db = getDb();
      await db.visitor.update({ where: { id }, data: { deletedAt: new Date() } });
      logger.info(`Visiteur archivé (soft delete) : id=${id}`);
      return { success: true };
    } catch (error: any) {
      logger.error('visitors:delete error', error.message);
      return { success: false, error: error.message };
    }
  });

  // ── Objets de visite (liste paramétrable) ──────────────────────────────────

  ipcMain.handle('visitors:listObjects', async (_event, { token, includeInactive = false }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_ROLES);
      const db = getDb();
      const data = await db.visitObject.findMany({
        where: { deletedAt: null, ...(includeInactive ? {} : { isActive: true }) },
        orderBy: { label: 'asc' },
      });
      return ser({ success: true, data });
    } catch (error: any) {
      logger.error('visitors:listObjects error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:createObject', async (_event, { token, label }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_OBJECT_ROLES);
      const value = String(label ?? '').trim();
      if (!value) return { success: false, error: 'Libellé requis' };
      const db = getDb();
      const exists = await db.visitObject.findFirst({ where: { label: value, deletedAt: null }, select: { id: true } });
      if (exists) return { success: false, error: 'Cet objet de visite existe déjà.' };
      const obj = await db.visitObject.create({ data: { label: value } });
      return ser({ success: true, data: obj });
    } catch (error: any) {
      logger.error('visitors:createObject error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:updateObject', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_OBJECT_ROLES);
      const db = getDb();
      const data: any = {};
      if (payload?.label !== undefined) {
        const value = String(payload.label).trim();
        if (!value) return { success: false, error: 'Libellé requis' };
        const exists = await db.visitObject.findFirst({ where: { label: value, deletedAt: null, id: { not: id } }, select: { id: true } });
        if (exists) return { success: false, error: 'Cet objet de visite existe déjà.' };
        data.label = value;
      }
      if (payload?.isActive !== undefined) data.isActive = !!payload.isActive;
      const obj = await db.visitObject.update({ where: { id }, data });
      return ser({ success: true, data: obj });
    } catch (error: any) {
      logger.error('visitors:updateObject error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:deleteObject', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_OBJECT_ROLES);
      const db = getDb();
      await db.visitObject.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
      return { success: true };
    } catch (error: any) {
      logger.error('visitors:deleteObject error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('visitors:stats', async (_event, { token }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkVisitorRole(session, VISITOR_ROLES);
      const db = getDb();
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const [total, today, month] = await db.$transaction([
        db.visitor.count({ where: { deletedAt: null } }),
        db.visitor.count({ where: { deletedAt: null, visitedAt: { gte: startOfDay } } }),
        db.visitor.count({ where: { deletedAt: null, visitedAt: { gte: startOfMonth } } }),
      ]);
      return { success: true, data: { total, today, month } };
    } catch (error: any) {
      logger.error('visitors:stats error', error.message);
      return { success: false, error: error.message };
    }
  });
}
