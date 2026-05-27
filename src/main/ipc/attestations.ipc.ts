import { ipcMain } from 'electron';
import { getDb } from '../services/db.service';
import { getSession, checkRole } from '../services/auth.service';
import logger from '../utils/logger';
import { z } from 'zod';

const WRITE_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER'];
const READ_ROLES = [...WRITE_ROLES, 'AGENT', 'ACCOUNTANT', 'READONLY'];

const ATTESTATION_TYPES = ['ATTRIBUTION', 'CESSION', 'SOLDE', 'TRANSFERT_PROPRIETE'] as const;

const attestationSchema = z
  .object({
    type: z.enum(ATTESTATION_TYPES),
    clientId: z.number().int().positive(),
    secondaryClientId: z.number().int().positive().optional(),
    terrainId: z.number().int().positive().optional(),
    propertyId: z.number().int().positive().optional(),
    conventionId: z.number().int().positive().optional(),
    templateId: z.number().int().positive().optional(),
    emittedAt: z.string().optional(),
    amount: z.number().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (d) => (d.type === 'CESSION' ? !!d.secondaryClientId : true),
    { message: 'Une attestation de cession nécessite un cédant (client secondaire)' },
  )
  .refine(
    (d) => (d.type === 'CESSION' ? d.clientId !== d.secondaryClientId : true),
    { message: 'Le cessionnaire et le cédant doivent être deux clients différents' },
  )
  .refine(
    (d) => !!d.terrainId || !!d.propertyId,
    { message: 'Sélectionnez un terrain ou un bien immobilier pour l\'attestation' },
  );

/**
 * Sérialise une valeur pour l'IPC : les objets Decimal de Prisma ne sont pas
 * clonables nativement par Electron. Round-trip JSON → types primitifs.
 */
const ser = <T>(v: T): T => JSON.parse(JSON.stringify(v));

/** Référence auto : ATT-YYYY-NNNN, séquence annuelle. */
async function nextReference(db: ReturnType<typeof getDb>): Promise<string> {
  const year = new Date().getFullYear();
  const last = await db.attestation.findFirst({
    where: { reference: { startsWith: `ATT-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  });
  const seq = last ? parseInt(last.reference.split('-')[2], 10) + 1 : 1;
  return `ATT-${year}-${String(seq).padStart(4, '0')}`;
}

const INCLUDE = {
  client:          { include: { idType: { select: { id: true, code: true, label: true } } } },
  secondaryClient: { include: { idType: { select: { id: true, code: true, label: true } } } },
  terrain: {
    include: {
      lotissement: {
        include: {
          titleType: { select: { id: true, code: true, label: true, documentsLivres: true } },
        },
      },
    },
  },
  property: true,
  convention: { include: { _count: { select: { terrains: true } } } },
  template: true,
  emittedBy: { select: { id: true, firstName: true, lastName: true, matricule: true } },
  documents: { where: { deletedAt: null }, orderBy: { uploadedAt: 'desc' as const } },
};

/**
 * Met à jour les champs `numeroAttestationAttribution` / `numeroAttestationCession`
 * sur le terrain rattaché lorsqu'une attestation pertinente est émise.
 */
async function syncTerrainAttestationFields(
  db: ReturnType<typeof getDb>,
  terrainId: number | null | undefined,
  type: string,
  reference: string,
): Promise<void> {
  if (!terrainId) return;
  if (type === 'ATTRIBUTION') {
    await db.terrain.update({
      where: { id: terrainId },
      data: { numeroAttestationAttribution: reference },
    });
  } else if (type === 'CESSION') {
    await db.terrain.update({
      where: { id: terrainId },
      data: { numeroAttestationCession: reference },
    });
  }
}

export function registerAttestationsIPC(): void {
  ipcMain.handle('attestations:list', async (_event, { token, filters = {}, page = 1, limit = 50 }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.type) where.type = filters.type;
      if (filters.clientId) where.clientId = Number(filters.clientId);
      if (filters.conventionId) where.conventionId = Number(filters.conventionId);
      if (filters.terrainId) where.terrainId = Number(filters.terrainId);
      if (filters.propertyId) where.propertyId = Number(filters.propertyId);
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { notes: { contains: filters.search } },
        ];
      }
      const [data, total] = await db.$transaction([
        db.attestation.findMany({
          where,
          include: INCLUDE,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { emittedAt: 'desc' },
        }),
        db.attestation.count({ where }),
      ]);
      return { success: true, data: ser(data), total };
    } catch (error: any) {
      logger.error('attestations:list error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('attestations:getById', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const attestation = await db.attestation.findUnique({ where: { id }, include: INCLUDE });
      if (!attestation || attestation.deletedAt) return { success: false, error: 'Attestation introuvable' };
      return { success: true, data: ser(attestation) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('attestations:create', async (_event, { token, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = attestationSchema.safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const reference = await nextReference(db);
      const d = parsed.data;
      const data: any = {
        reference,
        type: d.type,
        clientId: d.clientId,
        secondaryClientId: d.secondaryClientId,
        terrainId: d.terrainId,
        propertyId: d.propertyId,
        conventionId: d.conventionId,
        templateId: d.templateId,
        emittedAt: d.emittedAt ? new Date(d.emittedAt) : new Date(),
        emittedById: session.userId,
        amount: d.amount,
        notes: d.notes,
      };
      const attestation = await db.attestation.create({ data, include: INCLUDE });
      await syncTerrainAttestationFields(db, d.terrainId, d.type, reference);
      logger.info(`Attestation created: ${reference} (${d.type})`);
      return { success: true, data: ser(attestation) };
    } catch (error: any) {
      logger.error('attestations:create error', error.message);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('attestations:update', async (_event, { token, id, payload }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const parsed = attestationSchema.partial().safeParse(payload);
      if (!parsed.success) return { success: false, error: parsed.error.format() };
      const db = getDb();
      const d = parsed.data;
      const data: any = { ...d };
      if (d.emittedAt) data.emittedAt = new Date(d.emittedAt);
      const attestation = await db.attestation.update({
        where: { id },
        data,
        include: INCLUDE,
      });
      return { success: true, data: ser(attestation) };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('attestations:typeStats', async (_event, { token, filters = {} }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, READ_ROLES);
      const db = getDb();
      const where: any = { deletedAt: null };
      if (filters.clientId) where.clientId = Number(filters.clientId);
      if (filters.conventionId) where.conventionId = Number(filters.conventionId);
      if (filters.terrainId) where.terrainId = Number(filters.terrainId);
      if (filters.propertyId) where.propertyId = Number(filters.propertyId);
      if (filters.search) {
        where.OR = [
          { reference: { contains: filters.search } },
          { notes: { contains: filters.search } },
        ];
      }
      const rows = await db.attestation.groupBy({
        by: ['type'],
        where,
        _count: { _all: true },
      });
      const stats: Record<string, number> = {
        ATTRIBUTION: 0, CESSION: 0, SOLDE: 0, TRANSFERT_PROPRIETE: 0,
      };
      let total = 0;
      for (const r of rows) {
        const n = r._count?._all ?? 0;
        stats[r.type as string] = n;
        total += n;
      }
      return { success: true, data: { ...stats, total } };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('attestations:delete', async (_event, { token, id }: any) => {
    try {
      const session = getSession(token);
      if (!session) return { success: false, error: 'Session expirée' };
      checkRole(session, WRITE_ROLES);
      const db = getDb();
      await db.attestation.update({ where: { id }, data: { deletedAt: new Date() } });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}
