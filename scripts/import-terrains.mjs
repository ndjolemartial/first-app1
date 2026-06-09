import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const p = new PrismaClient();
const now = new Date();

const clean = (v) => { const s = (v ?? '').toString().trim(); return s === '' || s === '0' ? null : s; };
// Date source en texte ('2022-02-16') → Date, ou null si vide / 0000-00-00.
const pdate = (s) => (!s || String(s).startsWith('0000')) ? null : new Date(`${s}T00:00:00.000Z`);

// Chargement avec dates castées en CHAR (évite l'échec Prisma sur 0000-00-00).
const rows = await p.$queryRawUnsafe(
  `SELECT Num, lotissementId, numeroIlot, numeroParcelle, surface, clientId, ownerId, statut,
          numeroDM, titreFoncier, numeroACD, prixVente, acdDemarchesEnabled, acdDemarchesAmount,
          CAST(createdAt AS CHAR) createdAt, CAST(updatedAt AS CHAR) updatedAt,
          CAST(acdDemarchesStartDate AS CHAR) acdStart
   FROM \`ref_lots_from\` ORDER BY Num`);
console.log('Lignes source :', rows.length);

const existingClients = new Set((await p.client.findMany({ select: { id: true } })).map((c) => c.id));
const existingOwners = new Set((await p.owner.findMany({ select: { id: true } })).map((o) => o.id));
const existingLots = new Set((await p.lotissement.findMany({ select: { id: true } })).map((l) => l.id));

// Vidage préalable (ré-exécutable)
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0');
await p.$executeRawUnsafe('TRUNCATE TABLE `Terrain`');
await p.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1');

const seqByYear = {};
let orphanLot = 0, orphanClient = 0, orphanOwner = 0;
const data = rows.map((r) => {
  const created = pdate(r.createdAt) ?? pdate(r.updatedAt) ?? now;
  const year = created.getUTCFullYear();
  seqByYear[year] = (seqByYear[year] ?? 0) + 1;
  const reference = `TER-${year}-${String(seqByYear[year]).padStart(4, '0')}`;

  if (!existingLots.has(r.lotissementId)) orphanLot++;
  const clientId = r.clientId > 0 && existingClients.has(r.clientId) ? r.clientId : null;
  if (r.clientId > 0 && !clientId) orphanClient++;
  const ownerId = r.ownerId > 0 && existingOwners.has(r.ownerId) ? r.ownerId : null;
  if (r.ownerId > 0 && !ownerId) orphanOwner++;

  const acdEnabled = Number(r.acdDemarchesEnabled) === 1;
  const acdAmount = Number(r.acdDemarchesAmount) > 0 ? String(r.acdDemarchesAmount) : null;
  const prix = Number(r.prixVente) > 0 ? String(r.prixVente) : null;

  return {
    id: Number(r.Num),
    uuid: randomUUID(),
    reference,
    lotissementId: r.lotissementId,
    ownerId,
    clientId,
    numeroIlot: clean(r.numeroIlot),
    numeroParcelle: clean(r.numeroParcelle),
    statut: r.statut === 1 ? 'VENDU' : 'DISPONIBLE',
    surface: Number(r.surface) > 0 ? String(r.surface) : '0',
    prixVente: prix,
    viabilise: false,
    numeroDM: clean(r.numeroDM),
    titreFoncier: clean(r.titreFoncier),
    numeroACD: clean(r.numeroACD),
    acdDemarchesEnabled: acdEnabled,
    acdDemarchesAmount: acdAmount,
    acdDemarchesStartDate: acdEnabled ? pdate(r.acdStart) : null,
    createdAt: created,
    updatedAt: pdate(r.updatedAt) ?? created,
  };
});

console.log('Références par année :', seqByYear);
console.log(`Orphelins → lot:${orphanLot} client:${orphanClient} owner:${orphanOwner}`);

const res = await p.terrain.createMany({ data });
console.log('Insérés :', res.count);

const maxId = data.reduce((m, d) => Math.max(m, d.id), 0);
await p.$executeRawUnsafe(`ALTER TABLE \`Terrain\` AUTO_INCREMENT = ${maxId + 1}`);
console.log('Total terrain :', await p.terrain.count(), '— AUTO_INCREMENT ->', maxId + 1);
await p.$disconnect();
