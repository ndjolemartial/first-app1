// Import des échéances héritées (`mensualites_from`) → `SaleInstallment`.
//
// Source (ancienne application) : paiements échelonnés sur terrain rattachés
// directement au client, sans convention signée.
//   clientId int | amount int (FCFA) | dueDate date | status int | detailssouscription varchar
//
// Règles de mappage :
//   - conventionId = null, terrainId = null (absents de la source), clientId repris
//   - detailsSouscription = detailssouscription (affiché sur la facture)
//   - status 0 → EN_ATTENTE (les échues seront promues EN_RETARD à la lecture)
//   - installmentNumber : numéroté par groupe (client + souscription), trié par dueDate
//   - createdAt = dueDate pour les échéances passées, aujourd'hui pour les échéances
//     non encore arrivées ; updatedAt = createdAt
//
// Ré-exécutable : ne supprime que les échéances héritées NON payées et SANS facture.
// Abandonne si une échéance héritée est déjà payée / facturée (préserve les données réelles).
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const now = new Date();
const todayMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

// Date source en texte ('2022-12-05') → Date UTC, ou null si vide / 0000-00-00.
const pdate = (s) => (!s || String(s).startsWith('0000')) ? null : new Date(`${String(s).slice(0, 10)}T00:00:00.000Z`);

const mapStatus = (n) => {
  switch (Number(n)) {
    case 0: return 'EN_ATTENTE';
    default: return null; // valeur inattendue → signalée plus bas
  }
};

// ── Chargement source (dueDate castée en CHAR pour parsing robuste) ──────────
const rows = await p.$queryRawUnsafe(
  'SELECT clientId, amount, CAST(dueDate AS CHAR) dueDate, status, detailssouscription ' +
  'FROM `mensualites_from` ORDER BY clientId, detailssouscription, dueDate');
console.log('Lignes source :', rows.length);

const existingClients = new Set((await p.client.findMany({ select: { id: true } })).map((c) => c.id));

// ── Garde-fou de ré-exécution : ne pas détruire d'échéances héritées réelles ─
const protectedLegacy = await p.saleInstallment.findMany({
  where: { conventionId: null, OR: [{ status: 'PAYE' }, { invoiceId: { not: null } }] },
  select: { id: true },
});
if (protectedLegacy.length > 0) {
  console.error(
    `ABANDON : ${protectedLegacy.length} échéance(s) héritée(s) déjà payée(s)/facturée(s). ` +
    'Suppression refusée pour préserver les données réelles.');
  await p.$disconnect();
  process.exit(1);
}

// Suppression des héritées précédemment importées (et activités CRM liées).
const oldLegacy = await p.saleInstallment.findMany({ where: { conventionId: null }, select: { id: true } });
if (oldLegacy.length > 0) {
  const ids = oldLegacy.map((i) => i.id);
  await p.crmActivity.deleteMany({ where: { installmentId: { in: ids } } });
  await p.saleInstallment.deleteMany({ where: { id: { in: ids } } });
  console.log('Anciennes échéances héritées supprimées :', ids.length);
}

// ── Numérotation par groupe (client + souscription), tri par dueDate ─────────
const seqByGroup = {};
let orphanClient = 0, pastCount = 0, futureCount = 0, badStatus = 0;

const data = rows.map((r) => {
  const clientId = existingClients.has(r.clientId) ? r.clientId : null;
  if (clientId === null) orphanClient++;

  const groupKey = `${r.clientId}||${r.detailssouscription ?? ''}`;
  seqByGroup[groupKey] = (seqByGroup[groupKey] ?? 0) + 1;

  const dueDate = pdate(r.dueDate) ?? now;
  const isPast = dueDate < todayMidnight;
  if (isPast) pastCount++; else futureCount++;
  const createdAt = isPast ? dueDate : now;

  let status = mapStatus(r.status);
  if (status === null) { status = 'EN_ATTENTE'; badStatus++; }

  return {
    conventionId: null,
    clientId,
    terrainId: null,
    detailsSouscription: (r.detailssouscription ?? '').toString().trim() || null,
    installmentNumber: seqByGroup[groupKey],
    dueDate,
    amount: String(r.amount),
    status,
    createdAt,
    updatedAt: createdAt,
  };
}).filter((d) => d.clientId !== null); // on n'insère pas d'échéance sans client valide

console.log(`Groupes (client+souscription) : ${Object.keys(seqByGroup).length}`);
console.log(`Échéances passées : ${pastCount} | non encore arrivées : ${futureCount}`);
if (orphanClient > 0) console.warn(`⚠ ${orphanClient} ligne(s) avec clientId inexistant — ignorées`);
if (badStatus > 0) console.warn(`⚠ ${badStatus} ligne(s) avec status inattendu — forcées à EN_ATTENTE`);

const res = await p.saleInstallment.createMany({ data });
console.log('Insérées :', res.count);
console.log('Total héritées (conventionId null) :', await p.saleInstallment.count({ where: { conventionId: null } }));
await p.$disconnect();
