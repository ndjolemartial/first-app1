import { getDb } from './db.service';
import logger from '../utils/logger';
import { CONTRACT_TEMPLATE_DEFS } from './contract-template.service';

/**
 * Seeding et résolution des modèles éditables RH :
 *  - modèles de contrats de travail (un par défaut par type) ;
 *  - modèles de bulletins de paie (3 mises en page MODELE_1/2/3).
 * Idempotent : ne réécrit jamais un modèle déjà présent (préserve les éditions).
 */

/** Crée les modèles de contrats par défaut absents (un par type). */
export async function seedDefaultContractTemplates(): Promise<void> {
  const db = getDb();
  for (const def of CONTRACT_TEMPLATE_DEFS) {
    const exists = await db.contractTemplate.findFirst({
      where: { type: def.type as any, deletedAt: null },
      select: { id: true },
    });
    if (exists) continue;
    await db.contractTemplate.create({
      data: { name: def.name, type: def.type as any, body: def.body, isDefault: true, isActive: true },
    });
  }
}

const PAYSLIP_SEED = [
  { name: 'Bulletin — Modèle 1 (Classique)', layout: 'MODELE_1', isDefault: true },
  { name: 'Bulletin — Modèle 2 (Moderne)', layout: 'MODELE_2', isDefault: false },
  { name: 'Bulletin — Modèle 3 (Compact)', layout: 'MODELE_3', isDefault: false },
];

/** Crée les 3 modèles de bulletins par défaut si aucun n'existe. */
export async function seedDefaultPayslipTemplates(): Promise<void> {
  const db = getDb();
  const count = await db.payslipTemplate.count();
  if (count > 0) return;
  for (const t of PAYSLIP_SEED) {
    await db.payslipTemplate.create({
      data: { name: t.name, layout: t.layout as any, isDefault: t.isDefault, isActive: true },
    });
  }
  logger.info('Modèles de bulletins de paie créés (3 modèles)');
}

/** Résout le corps du modèle de contrat par défaut pour un type donné. */
export async function resolveContractTemplateBody(type: string): Promise<string | null> {
  const db = getDb();
  const tpl = await db.contractTemplate.findFirst({
    where: { type: type as any, isActive: true, deletedAt: null },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    select: { body: true },
  });
  return tpl?.body ?? null;
}

/** Résout le modèle de bulletin par défaut (ou le premier actif). */
export async function resolvePayslipTemplate(): Promise<{ layout: string; headerHtml: string | null; footerHtml: string | null; accentColor: string } | null> {
  const db = getDb();
  const tpl = await db.payslipTemplate.findFirst({
    where: { isActive: true },
    orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
    select: { layout: true, headerHtml: true, footerHtml: true, accentColor: true },
  });
  return tpl ?? null;
}
